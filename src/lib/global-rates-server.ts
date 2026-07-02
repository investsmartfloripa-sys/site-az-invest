/**
 * Fetchers SERVER-ONLY das curvas soberanas internacionais. Cada fonte é pública
 * e gratuita, testada como acessível deste ambiente; o fetch roda no servidor
 * (route handlers em /api/global-rates/*) porque ECB/Bundesbank/BoE NÃO liberam
 * CORS — então não dá p/ buscar do navegador como fazemos com a B3.
 *
 * Fontes:
 *   - Japão (jp):     MOF — interest_rate/jgbcme.csv (ano corrente) +
 *                     historical/jgbcme_all.csv (histórico). Prazos 1..40a.
 *   - Alemanha (de):  Bundesbank — Zinsstrukturkurve (Svensson), série BBSIS por
 *                     prazo (R01XX..R30XX). Decimal com vírgula.
 *   - Reino Unido (gb): Bank of England IADB — par yields nominais de gilts
 *                     (IUDSNPY 5a, IUDMNPY 10a, IUDLNPY 20a).
 *   - EUA (us):       FRED (keyless fredgraph.csv) — DGS1/2/3/5/7/10/20/30.
 *   - Colômbia (co):  BanRep SUAMECA REST — TES pesos cero cupón 1/5/10a
 *                     (POST JSON, diário desde 2003, carga em lotes com lag
 *                     de ~3–7 dias corridos).
 *   - Zona do euro:   ECB Data Portal — curva AAA curta (SR_3M/6M/1Y/2Y) p/ a
 *                     BCE implícita da Alemanha.
 *
 * Todas as respostas degradam para null em falha; o front mostra fallback.
 */

import "server-only";

import {
  BANREP_DECISION_DATES,
  ECB_DECISION_DATES,
  futureMeetings,
  impliedPolicyPath,
  policyLevelAt,
  type CountryCurve,
  type CountryHistory,
  type CountryRatesPayload,
  type CurvePoint,
  type GlobalCountryId,
  type PolicyRow,
  type PolicySegment,
  type TenorHistory,
} from "@/lib/global-rates";
import {
  BOJ_DECISION_DATES,
  FOMC_DECISION_DATES,
  fedFundsImpliedPath,
  futuresSymbol,
  monthlySchedule,
  type FuturesQuote,
} from "@/lib/rate-futures";
import { painelBlobUrl } from "@/lib/painel-blob";

const UA = "Mozilla/5.0 (compatible; AZInvestBot/1.0; +https://investimentosdeaz.com.br)";

/** GET de texto com User-Agent, timeout e revalidação ISR. null em erro. */
async function fetchText(
  url: string,
  revalidate: number,
  timeoutMs = 20_000,
): Promise<string | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

const CURVE_REVALIDATE = 900; // 15 min — curva do dia (atualiza ao longo do dia útil)
const HISTORY_REVALIDATE = 21_600; // 6 h — histórico longo muda devagar

// ---------------------------------------------------------------------------
// Helpers de data / parsing
// ---------------------------------------------------------------------------

function isoNDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const MONTHS3: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "22 Jun 2026" → "2026-06-22" (formato do Bank of England). */
function boeDateToISO(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const mm = MONTHS3[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

/** "2026/6/1" → "2026-06-01" (formato do MOF). */
function jpDateToISO(s: string): string | null {
  const m = s.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** Número tolerante a vírgula decimal e branco/"." de "sem valor". */
function parseRate(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim().replace(",", ".");
  if (t === "" || t === "." || t === "-") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Mantém só a última observação de cada semana ISO (downsample p/ histórico leve). */
function downsampleWeekly(points: [string, number][]): [string, number][] {
  const byWeek = new Map<string, [string, number]>();
  for (const p of points) {
    const d = new Date(`${p[0]}T00:00:00Z`);
    // Chave ano-semana (segunda-feira como âncora).
    const day = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d.getTime() - day * 86_400_000);
    const key = monday.toISOString().slice(0, 10);
    byWeek.set(key, p); // ordem crescente → fica a última da semana
  }
  return [...byWeek.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Curva com cortes históricos (Agora / D-1 / D-30 / D-90)
// ---------------------------------------------------------------------------

type TenorHist = { years: number; hist: [string, number][] };

function isoDaysBefore(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/** Monta a curva (Agora / D-1 / D-30 / D-90) a partir de séries por prazo. */
function curveWithCuts(country: GlobalCountryId, perTenor: TenorHist[], sourceLabel: string): CountryCurve | null {
  const dates = new Set<string>();
  for (const t of perTenor) for (const [d] of t.hist) dates.add(d);
  const sorted = [...dates].sort();
  if (sorted.length === 0) return null;
  const oldest = sorted[0];
  const asOf = sorted[sorted.length - 1];
  const prevAsOf = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
  const d30AsOf = isoDaysBefore(asOf, 30);
  const d90AsOf = isoDaysBefore(asOf, 90);
  const cut = (ref: string): CurvePoint[] =>
    perTenor
      .map((t) => {
        const r = valueOnOrBefore(t.hist, ref);
        return r == null ? null : { years: t.years, rate: r };
      })
      .filter((p): p is CurvePoint => p != null)
      .sort((a, b) => a.years - b.years);
  const tenors = cut(asOf);
  if (tenors.length < 1) return null;
  const has30 = d30AsOf >= oldest;
  const has90 = d90AsOf >= oldest;
  return {
    country,
    asOf,
    tenors,
    prevAsOf,
    prevTenors: prevAsOf ? cut(prevAsOf) : undefined,
    d30AsOf: has30 ? d30AsOf : undefined,
    d30Tenors: has30 ? cut(d30AsOf) : undefined,
    d90AsOf: has90 ? d90AsOf : undefined,
    d90Tenors: has90 ? cut(d90AsOf) : undefined,
    source: sourceLabel,
  };
}

// ---------------------------------------------------------------------------
// Japão — MOF (JGB CME)
// ---------------------------------------------------------------------------

const JP_BASE = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate";
/** Ordem das colunas do CSV do MOF (após a coluna Date). */
const JP_TENORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40];

type JpRow = { iso: string; rates: (number | null)[] };

function parseJapanCsv(csv: string): JpRow[] {
  const out: JpRow[] = [];
  for (const line of csv.split(/\r?\n/)) {
    const cols = line.split(",");
    const iso = jpDateToISO(cols[0] ?? "");
    if (!iso) continue;
    const rates = JP_TENORS.map((_, i) => parseRate(cols[i + 1]));
    if (rates.some((r) => r != null)) out.push({ iso, rates });
  }
  return out;
}

async function getJapanCurve(): Promise<CountryCurve | null> {
  // jgbcme.csv (mês corrente, FRESCO) + historical/jgbcme_all.csv (série longa, mas
  // com ~1 mês de defasagem) mesclados: cortes D-30/D-90 do histórico, Agora/D-1 do
  // mês corrente. O mês corrente sobrescreve o histórico no overlap.
  const [curCsv, histCsv] = await Promise.all([
    fetchText(`${JP_BASE}/jgbcme.csv`, CURVE_REVALIDATE),
    fetchText(`${JP_BASE}/historical/jgbcme_all.csv`, CURVE_REVALIDATE, 30_000),
  ]);
  const rowsMap = new Map<string, JpRow>();
  for (const r of parseJapanCsv(histCsv ?? "")) rowsMap.set(r.iso, r);
  for (const r of parseJapanCsv(curCsv ?? "")) rowsMap.set(r.iso, r);
  const rows = [...rowsMap.values()].sort((a, b) => (a.iso < b.iso ? -1 : 1));
  if (rows.length === 0) return null;
  const perTenor: TenorHist[] = JP_TENORS.map((years, i) => ({
    years,
    hist: rows
      .map((r) => [r.iso, r.rates[i]] as [string, number | null])
      .filter((x): x is [string, number] => x[1] != null),
  }));
  return curveWithCuts("jp", perTenor, "Ministério das Finanças do Japão (JGB)");
}

async function getJapanHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const csv = await fetchText(`${JP_BASE}/historical/jgbcme_all.csv`, HISTORY_REVALIDATE, 30_000);
  if (!csv) return null;
  const rows = parseJapanCsv(csv).filter((r) => r.iso >= cutoffISO);
  if (rows.length === 0) return null;
  const series: TenorHistory[] = tenors.map((years) => {
    const idx = JP_TENORS.indexOf(years);
    const points: [string, number][] = [];
    if (idx >= 0) {
      for (const r of rows) {
        const v = r.rates[idx];
        if (v != null) points.push([r.iso, v]);
      }
    }
    return { years, points: downsampleWeekly(points) };
  });
  return {
    country: "jp",
    asOf: rows[rows.length - 1].iso,
    series: series.filter((s) => s.points.length > 0),
    source: "Ministério das Finanças do Japão (JGB)",
  };
}

// ---------------------------------------------------------------------------
// Alemanha — Deutsche Bundesbank (Zinsstrukturkurve Svensson)
// ---------------------------------------------------------------------------

const BBK_BASE = "https://api.statistiken.bundesbank.de/rest/data/BBSIS";
/** Código do prazo na chave BBSIS (R<NN>XX = NN anos de RLZ). */
function bbkTenorCode(years: number): string {
  return `R${String(years).padStart(2, "0")}XX`;
}
function bbkSeriesKey(years: number): string {
  return `D.I.ZST.ZI.EUR.S1311.B.A604.${bbkTenorCode(years)}.R.A.A._Z._Z.A`;
}
const DE_CURVE_TENORS = [1, 2, 3, 5, 7, 10, 15, 20, 30];

/** Lê (iso, valor) válidos de uma série BBSIS (CSV ;-separado, decimal vírgula). */
function parseBundesbankCsv(csv: string): [string, number][] {
  const out: [string, number][] = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!/^\d{4}-\d{2}-\d{2};/.test(line)) continue;
    const cols = line.split(";");
    const v = parseRate(cols[1]);
    if (v != null) out.push([cols[0], v]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

async function fetchBundesbankSeries(
  years: number,
  startISO: string,
  revalidate: number,
): Promise<[string, number][]> {
  const url = `${BBK_BASE}/${bbkSeriesKey(years)}?format=csv&startPeriod=${startISO}`;
  const csv = await fetchText(url, revalidate);
  return csv ? parseBundesbankCsv(csv) : [];
}

async function getGermanyCurve(): Promise<CountryCurve | null> {
  const start = isoNDaysAgo(100);
  const perTenor = await Promise.all(
    DE_CURVE_TENORS.map(async (years) => ({ years, hist: await fetchBundesbankSeries(years, start, CURVE_REVALIDATE) })),
  );
  const valid = perTenor.filter((t) => t.hist.length > 0);
  if (valid.length < 3) return null;
  return curveWithCuts("de", valid, "Deutsche Bundesbank (Svensson)");
}

async function getGermanyHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const results = await Promise.all(
    tenors.map(async (years) => ({
      years,
      obs: await fetchBundesbankSeries(years, cutoffISO, HISTORY_REVALIDATE),
    })),
  );
  const series: TenorHistory[] = results
    .map((r) => ({ years: r.years, points: downsampleWeekly(r.obs) }))
    .filter((s) => s.points.length > 0);
  if (series.length === 0) return null;
  const asOf = series.reduce((mx, s) => {
    const d = s.points[s.points.length - 1][0];
    return d > mx ? d : mx;
  }, "0000-00-00");
  return { country: "de", asOf, series, source: "Deutsche Bundesbank (Svensson)" };
}

// ---------------------------------------------------------------------------
// Reino Unido — Bank of England (par yields nominais de gilts)
// ---------------------------------------------------------------------------

const BOE_BASE = "https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp";
/** Códigos IADB de par yield nominal por prazo (os disponíveis gratuitamente). */
const BOE_CODES: { code: string; years: number }[] = [
  { code: "IUDSNPY", years: 5 },
  { code: "IUDMNPY", years: 10 },
  { code: "IUDLNPY", years: 20 },
];

function boeDateUK(iso: string): string {
  // BoE espera DD/Mon/YYYY.
  const [y, m, d] = iso.split("-");
  const mon = Object.entries(MONTHS3).find(([, v]) => v === m)?.[0];
  const Mon = mon ? mon[0].toUpperCase() + mon.slice(1) : m;
  return `${d}/${Mon}/${y}`;
}

/** CSV do BoE: cabeçalho de séries, linha em branco, cabeçalho DATE,..., dados. */
function parseBoeCsv(csv: string): { codes: string[]; rows: { iso: string; vals: (number | null)[] }[] } {
  const lines = csv.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^DATE,/i.test(lines[i].trim())) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { codes: [], rows: [] };
  const codes = lines[headerIdx].split(",").slice(1).map((s) => s.trim());
  const rows: { iso: string; vals: (number | null)[] }[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const iso = boeDateToISO(cols[0] ?? "");
    if (!iso) continue;
    rows.push({ iso, vals: codes.map((_, j) => parseRate(cols[j + 1])) });
  }
  rows.sort((a, b) => (a.iso < b.iso ? -1 : 1));
  return { codes, rows };
}

async function fetchBoe(fromISO: string, revalidate: number) {
  const codes = BOE_CODES.map((c) => c.code).join(",");
  const url =
    `${BOE_BASE}?csv.x=yes&Datefrom=${encodeURIComponent(boeDateUK(fromISO))}&Dateto=now` +
    `&SeriesCodes=${codes}&CSVF=TT&UsingCodes=Y&VPD=Y&VFD=N`;
  const csv = await fetchText(url, revalidate, 25_000);
  return csv ? parseBoeCsv(csv) : { codes: [], rows: [] };
}

/** Mapa código→prazo segundo a ordem real das colunas devolvidas. */
function boeTenorOf(code: string): number | null {
  return BOE_CODES.find((c) => c.code === code)?.years ?? null;
}

async function getUKCurve(): Promise<CountryCurve | null> {
  const { codes, rows } = await fetchBoe(isoNDaysAgo(100), CURVE_REVALIDATE);
  if (rows.length === 0) return null;
  const perTenor: TenorHist[] = [];
  codes.forEach((code, j) => {
    const years = boeTenorOf(code);
    if (years == null) return;
    const hist = rows
      .map((r) => [r.iso, r.vals[j]] as [string, number | null])
      .filter((x): x is [string, number] => x[1] != null);
    if (hist.length > 0) perTenor.push({ years, hist });
  });
  if (perTenor.length === 0) return null;
  return curveWithCuts("gb", perTenor, "Bank of England (gilts, par yields)");
}

async function getUKHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const { codes, rows } = await fetchBoe(cutoffISO, HISTORY_REVALIDATE);
  if (rows.length === 0) return null;
  const wanted = new Set(tenors);
  const series: TenorHistory[] = [];
  codes.forEach((code, j) => {
    const years = boeTenorOf(code);
    if (years == null || !wanted.has(years)) return;
    const points: [string, number][] = [];
    for (const r of rows) {
      const v = r.vals[j];
      if (v != null) points.push([r.iso, v]);
    }
    if (points.length > 0) series.push({ years, points: downsampleWeekly(points) });
  });
  if (series.length === 0) return null;
  return {
    country: "gb",
    asOf: rows[rows.length - 1].iso,
    series: series.sort((a, b) => a.years - b.years),
    source: "Bank of England (gilts, par yields)",
  };
}

// ---------------------------------------------------------------------------
// EUA — FRED (keyless fredgraph.csv) — só p/ o comparador histórico
// ---------------------------------------------------------------------------

const FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const US_FRED_TENORS: { id: string; years: number }[] = [
  { id: "DGS1", years: 1 },
  { id: "DGS2", years: 2 },
  { id: "DGS3", years: 3 },
  { id: "DGS5", years: 5 },
  { id: "DGS7", years: 7 },
  { id: "DGS10", years: 10 },
  { id: "DGS20", years: 20 },
  { id: "DGS30", years: 30 },
];

function parseFredCsv(csv: string): [string, number][] {
  const out: [string, number][] = [];
  const lines = csv.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cols[0] ?? "")) continue;
    const v = parseRate(cols[1]);
    if (v != null) out.push([cols[0], v]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

async function fetchFred(id: string, startISO: string, revalidate: number): Promise<[string, number][]> {
  const csv = await fetchText(`${FRED_CSV}?id=${id}&cosd=${startISO}`, revalidate);
  return csv ? parseFredCsv(csv) : [];
}

async function getUSCurve(): Promise<CountryCurve | null> {
  const start = isoNDaysAgo(100);
  const perTenor = await Promise.all(
    US_FRED_TENORS.map(async (t) => ({ years: t.years, hist: await fetchFred(t.id, start, CURVE_REVALIDATE) })),
  );
  const valid = perTenor.filter((t) => t.hist.length > 0);
  if (valid.length < 3) return null;
  return curveWithCuts("us", valid, "FRED (Treasury constant maturity)");
}

async function getUSHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const wanted = US_FRED_TENORS.filter((t) => tenors.includes(t.years));
  const results = await Promise.all(
    wanted.map(async (t) => ({ years: t.years, obs: await fetchFred(t.id, cutoffISO, HISTORY_REVALIDATE) })),
  );
  const series: TenorHistory[] = results
    .map((r) => ({ years: r.years, points: downsampleWeekly(r.obs) }))
    .filter((s) => s.points.length > 0);
  if (series.length === 0) return null;
  const asOf = series.reduce((mx, s) => {
    const d = s.points[s.points.length - 1][0];
    return d > mx ? d : mx;
  }, "0000-00-00");
  return { country: "us", asOf, series, source: "FRED (Treasury constant maturity)" };
}

// ---------------------------------------------------------------------------
// Colômbia — Banco de la República (SUAMECA, TES pesos cero cupón)
// ---------------------------------------------------------------------------

const BANREP_URL =
  "https://suameca.banrep.gov.co/buscador-de-series/rest/buscadorSeriesRestService/consultaDatosSeries";
/** idSerie do SUAMECA por prazo (TES pesos cero cupón). */
const CO_SERIES: { idSerie: number; years: number }[] = [
  { idSerie: 15272, years: 1 },
  { idSerie: 15273, years: 5 },
  { idSerie: 15274, years: 10 },
];

function isoToBanrepNum(iso: string): number {
  return Number(iso.replaceAll("-", ""));
}

/** POST JSON do SUAMECA: devolve [iso, %][] por série (data = [[epoch_ms, valor]]). */
async function fetchBanrepSeries(
  ids: number[],
  startISO: string,
  revalidate: number,
): Promise<Map<number, [string, number][]>> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 25_000);
  const out = new Map<number, [string, number][]>();
  try {
    const res = await fetch(BANREP_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        series: ids.map((idSerie) => ({ idSerie, idPeriodicidades: [1] })),
        fechaInicio: isoToBanrepNum(startISO),
        fechaFin: isoToBanrepNum(todayISO()),
      }),
      next: { revalidate },
    });
    if (!res.ok) return out;
    const json = (await res.json()) as { id?: number; data?: [number, number][] }[];
    for (const s of json ?? []) {
      if (typeof s?.id !== "number" || !Array.isArray(s.data)) continue;
      const pts: [string, number][] = [];
      for (const [ms, v] of s.data) {
        if (typeof ms === "number" && typeof v === "number" && Number.isFinite(v)) {
          pts.push([new Date(ms).toISOString().slice(0, 10), v]);
        }
      }
      pts.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      out.set(s.id, pts);
    }
    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(id);
  }
}

async function getColombiaCurve(): Promise<CountryCurve | null> {
  // Janela maior que os ~100d dos demais: a carga do BanRep tem lag de dias.
  const bySeries = await fetchBanrepSeries(
    CO_SERIES.map((s) => s.idSerie),
    isoNDaysAgo(130),
    CURVE_REVALIDATE,
  );
  const perTenor: TenorHist[] = CO_SERIES.map((s) => ({
    years: s.years,
    hist: bySeries.get(s.idSerie) ?? [],
  })).filter((t) => t.hist.length > 0);
  if (perTenor.length < 2) return null;
  return curveWithCuts("co", perTenor, "Banco de la República (TES cero cupón)");
}

async function getColombiaHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const bySeries = await fetchBanrepSeries(
    CO_SERIES.map((s) => s.idSerie),
    cutoffISO,
    HISTORY_REVALIDATE,
  );
  const series: TenorHistory[] = CO_SERIES.filter((s) => tenors.includes(s.years))
    .map((s) => ({ years: s.years, points: downsampleWeekly(bySeries.get(s.idSerie) ?? []) }))
    .filter((s) => s.points.length > 0);
  if (series.length === 0) return null;
  const asOf = series.reduce((mx, s) => {
    const d = s.points[s.points.length - 1][0];
    return d > mx ? d : mx;
  }, "0000-00-00");
  return { country: "co", asOf, series, source: "Banco de la República (TES cero cupón)" };
}

// ---------------------------------------------------------------------------
// China (cn) e Brasil (br) — arquivos de PIPELINE no Blob (fontes frágeis ou
// de janela curta NÃO são consultadas ao vivo; cron diário grava, o site lê).
//   data/china_curve.json — build_china_curve.py (ChinaBond/CCDC)
//   data/br_ettj.json     — build_br_ettj.py (ANBIMA ETTJ + Tesouro backfill)
// ---------------------------------------------------------------------------

type ChinaCurveFile = {
  status?: string;
  tenors_years?: number[];
  dates?: Record<string, (number | null)[]>;
};

type BrEttjFile = {
  status?: string;
  tenors_years?: number[];
  dates?: Record<string, { pre?: (number | null)[] | null }>;
};

async function fetchBlobJson<T>(path: string, revalidate: number): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Séries por prazo do arquivo da China: [{years, hist}] ordenado por data. */
async function loadChinaPerTenor(revalidate: number): Promise<TenorHist[] | null> {
  const f = await fetchBlobJson<ChinaCurveFile>("data/china_curve.json", revalidate);
  if (!f?.dates || !Array.isArray(f.tenors_years)) return null;
  const perTenor: TenorHist[] = f.tenors_years.map((y) => ({ years: y, hist: [] }));
  for (const iso of Object.keys(f.dates).sort()) {
    const vals = f.dates[iso];
    if (!Array.isArray(vals)) continue;
    perTenor.forEach((t, i) => {
      const v = vals[i];
      if (typeof v === "number" && Number.isFinite(v)) t.hist.push([iso, v]);
    });
  }
  const valid = perTenor.filter((t) => t.hist.length > 0);
  return valid.length >= 3 ? valid : null;
}

async function getChinaCurve(): Promise<CountryCurve | null> {
  const perTenor = await loadChinaPerTenor(CURVE_REVALIDATE);
  if (!perTenor) return null;
  return curveWithCuts("cn", perTenor, "ChinaBond (CCDC)");
}

async function getChinaHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const perTenor = await loadChinaPerTenor(HISTORY_REVALIDATE);
  if (!perTenor) return null;
  const series: TenorHistory[] = perTenor
    .filter((t) => tenors.includes(t.years))
    .map((t) => ({ years: t.years, points: downsampleWeekly(t.hist.filter(([d]) => d >= cutoffISO)) }))
    .filter((s) => s.points.length > 0);
  if (series.length === 0) return null;
  const asOf = series.reduce((mx, s) => {
    const d = s.points[s.points.length - 1][0];
    return d > mx ? d : mx;
  }, "0000-00-00");
  return { country: "cn", asOf, series, source: "ChinaBond (CCDC)" };
}

/** Histórico da curva PRÉ do Brasil (1/2/5/10a) — só p/ o comparador. */
async function getBrazilHistory(tenors: number[], cutoffISO: string): Promise<CountryHistory | null> {
  const f = await fetchBlobJson<BrEttjFile>("data/br_ettj.json", HISTORY_REVALIDATE);
  if (!f?.dates || !Array.isArray(f.tenors_years)) return null;
  const perTenor: TenorHist[] = f.tenors_years.map((y) => ({ years: y, hist: [] }));
  for (const iso of Object.keys(f.dates).sort()) {
    if (iso < cutoffISO) continue;
    const pre = f.dates[iso]?.pre;
    if (!Array.isArray(pre)) continue;
    perTenor.forEach((t, i) => {
      const v = pre[i];
      if (typeof v === "number" && Number.isFinite(v)) t.hist.push([iso, v]);
    });
  }
  const series: TenorHistory[] = perTenor
    .filter((t) => tenors.includes(t.years))
    .map((t) => ({ years: t.years, points: downsampleWeekly(t.hist) }))
    .filter((s) => s.points.length > 0);
  if (series.length === 0) return null;
  const asOf = series.reduce((mx, s) => {
    const d = s.points[s.points.length - 1][0];
    return d > mx ? d : mx;
  }, "0000-00-00");
  return { country: "br", asOf, series, source: "ANBIMA (ETTJ pré) / Tesouro Direto" };
}

// ---------------------------------------------------------------------------
// Zona do euro — ECB Data Portal (curva AAA curta) p/ a BCE implícita
// ---------------------------------------------------------------------------

const ECB_BASE = "https://data-api.ecb.europa.eu/service/data/YC";
const ECB_SHORT: { srid: string; years: number }[] = [
  { srid: "SR_3M", years: 0.25 },
  { srid: "SR_6M", years: 0.5 },
  { srid: "SR_1Y", years: 1 },
  { srid: "SR_2Y", years: 2 },
  { srid: "SR_3Y", years: 3 },
];

/** Última observação (csvdata): data no campo 8, valor no campo 9. */
function parseEcbLast(csv: string): number | null {
  const lines = csv.trim().split(/\r?\n/);
  const last = lines[lines.length - 1];
  const cols = last.split(",");
  return parseRate(cols[9]);
}

/** Curva curta AAA da zona do euro (à vista) p/ a BCE implícita. */
export async function getEcbShortCurve(): Promise<CurvePoint[]> {
  const pts = await Promise.all(
    ECB_SHORT.map(async (t) => {
      const url = `${ECB_BASE}/B.U2.EUR.4F.G_N_A.SV_C_YM.${t.srid}?format=csvdata&lastNObservations=1`;
      const csv = await fetchText(url, CURVE_REVALIDATE);
      const v = csv ? parseEcbLast(csv) : null;
      return v != null ? { years: t.years, rate: v } : null;
    }),
  );
  return pts.filter((p): p is CurvePoint => p != null).sort((a, b) => a.years - b.years);
}

// ---------------------------------------------------------------------------
// Dispatch por país
// ---------------------------------------------------------------------------

export async function getCountryCurve(country: GlobalCountryId): Promise<CountryCurve | null> {
  switch (country) {
    case "jp":
      return getJapanCurve();
    case "de":
      return getGermanyCurve();
    case "gb":
      return getUKCurve();
    case "us":
      return getUSCurve();
    case "co":
      return getColombiaCurve();
    case "cn":
      return getChinaCurve();
    default:
      return null;
  }
}

export async function getCountryHistory(
  country: GlobalCountryId,
  tenors: number[],
  cutoffISO: string,
): Promise<CountryHistory | null> {
  switch (country) {
    case "jp":
      return getJapanHistory(tenors, cutoffISO);
    case "de":
      return getGermanyHistory(tenors, cutoffISO);
    case "gb":
      return getUKHistory(tenors, cutoffISO);
    case "us":
      return getUSHistory(tenors, cutoffISO);
    case "co":
      return getColombiaHistory(tenors, cutoffISO);
    case "cn":
      return getChinaHistory(tenors, cutoffISO);
    case "br":
      return getBrazilHistory(tenors, cutoffISO);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Política monetária implícita via FUTUROS de juros (Yahoo Finance) — a proxy
// de mercado em tempo real (mesmo princípio do DI→Selic da B3). Fetch server-side
// (Yahoo não libera CORS) com ~15 min de atraso; cache curto p/ atualizar no dia.
// ---------------------------------------------------------------------------

const FUTURES_HISTORY_REVALIDATE = 3_600; // 1 h — histórico dos contratos muda devagar

/** Histórico diário (range=6mo) de um símbolo Yahoo: [iso, close][] crescente. */
async function fetchYahooHistory(symbol: string): Promise<[string, number][]> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`,
      { signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: FUTURES_HISTORY_REVALIDATE } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const r = json?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const cl = r?.indicators?.quote?.[0]?.close ?? [];
    const out: [string, number][] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = cl[i];
      if (typeof c === "number" && Number.isFinite(c)) {
        out.push([new Date(ts[i] * 1000).toISOString().slice(0, 10), c]);
      }
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(id);
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
function fmtRefDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Último valor de uma série [iso,valor][] com data <= alvo (ou o mais antigo). */
function valueOnOrBefore(hist: [string, number][], targetISO: string): number | null {
  if (hist.length === 0) return null;
  let val: number | null = null;
  for (const [iso, c] of hist) {
    if (iso <= targetISO) val = c;
    else break;
  }
  return val ?? hist[0][1];
}

type ContractHist = { year: number; month: number; hist: [string, number][] };

/** Tira (year/month → taxa=100−preço) usando o preço de cada contrato na data-ref. */
function stripAt(contracts: ContractHist[], refISO: string): FuturesQuote[] {
  return contracts
    .map((c) => {
      const price = valueOnOrBefore(c.hist, refISO);
      if (price == null) return null;
      return { symbol: "", year: c.year, month: c.month, price, rate: Math.round((100 - price) * 1000) / 1000 } as FuturesQuote;
    })
    .filter((q): q is FuturesQuote => q != null);
}

/**
 * Linhas por reunião/degrau (padrão Selic): usa as datas de degrau do caminho D+0
 * como eixo e amostra os 3 caminhos (hoje / −30d / −90d) em cada data — os 3 ficam
 * ALINHADOS no mesmo eixo x (o calendário de reuniões/IMM é fixo).
 */
function buildPolicyRows(
  pathD0: PolicySegment[],
  pathD30: PolicySegment[],
  pathD90: PolicySegment[],
): PolicyRow[] {
  return pathD0.map((seg) => ({
    date: seg.fromISO,
    d0: seg.level,
    d30: policyLevelAt(pathD30, seg.fromISO),
    d90: policyLevelAt(pathD90, seg.fromISO),
  }));
}

// (buildRowsAtDates removida junto com a pseudo-implícita do Reino Unido —
// sem tira de SONIA gratuita, a "implícita" era uma linha chapada sem
// conteúdo informativo; o UK ficou curva-only.)

/** Série (multi-linha) de uma chave da curva ECB (csvdata): [iso, valor][]. */
function parseEcbSeries(csv: string): [string, number][] {
  const out: [string, number][] = [];
  const lines = csv.trim().split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = cols[8];
    const v = parseRate(cols[9]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") && v != null) out.push([date, v]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Curva curta AAA da zona do euro COM histórico → função curveAt(refISO). */
async function fetchEcbShortHistory(): Promise<(iso: string) => CurvePoint[]> {
  const start = isoDaysAgo(130);
  const series = await Promise.all(
    ECB_SHORT.map(async (t) => {
      const url = `${ECB_BASE}/B.U2.EUR.4F.G_N_A.SV_C_YM.${t.srid}?format=csvdata&startPeriod=${start}`;
      const csv = await fetchText(url, FUTURES_HISTORY_REVALIDATE, 20_000);
      return { years: t.years, hist: csv ? parseEcbSeries(csv) : [] };
    }),
  );
  return (iso: string) =>
    series
      .map((s) => {
        const r = valueOnOrBefore(s.hist, iso);
        return r == null ? null : { years: s.years, rate: r };
      })
      .filter((p): p is CurvePoint => p != null)
      .sort((a, b) => a.years - b.years);
}

/** Curva curta de JGB (1..5a) COM histórico (MOF) → função curveAt(refISO). */
async function fetchJgbShortHistory(): Promise<(iso: string) => CurvePoint[]> {
  const csv = await fetchText(`${JP_BASE}/historical/jgbcme_all.csv`, HISTORY_REVALIDATE, 30_000);
  const rows = csv ? parseJapanCsv(csv) : [];
  const wanted = [1, 2, 3, 5];
  const byTenor = wanted.map((y) => ({ years: y, idx: JP_TENORS.indexOf(y), hist: [] as [string, number][] }));
  for (const r of rows) {
    for (const bt of byTenor) {
      const v = bt.idx >= 0 ? r.rates[bt.idx] : null;
      if (v != null) bt.hist.push([r.iso, v]);
    }
  }
  byTenor.forEach((bt) => bt.hist.sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  return (iso: string) =>
    byTenor
      .map((bt) => {
        const r = valueOnOrBefore(bt.hist, iso);
        return r == null ? null : { years: bt.years, rate: r };
      })
      .filter((p): p is CurvePoint => p != null)
      .sort((a, b) => a.years - b.years);
}

type FuturesPolicy = NonNullable<CountryRatesPayload["policy"]>;

/** Fetch do histórico de cada contrato de uma tira; descarta os sem dados. */
async function fetchStripHistories(
  schedule: { year: number; month: number }[],
  root: string,
  suffix: string,
  sep = "",
): Promise<ContractHist[]> {
  const all = await Promise.all(
    schedule.map(async (s) => ({
      year: s.year,
      month: s.month,
      hist: await fetchYahooHistory(futuresSymbol(root, s.year, s.month, suffix, sep)),
    })),
  );
  return all.filter((c) => c.hist.length > 0);
}

/**
 * Trajetória de política implícita por país a partir dos FUTUROS, agora com
 * histórico D-30/D-90 (a MESMA tira precificada há ~30 e ~90 dias) — padrão da
 * Selic implícita, para dar consistência visual entre todos os países.
 *   us → Fed Funds futures (mensal, reunião-a-reunião, estilo CME FedWatch);
 *   de → €STR futures (trimestral) — a taxa que o BCE de fato mira;
 *   jp → 3-Month TONA futures (trimestral) — overnight do BoJ;
 *   gb → Bank Rate do BoE + futuro SONIA contínuo (só o próximo trimestre — não há
 *        tira datada de SONIA gratuita).
 */
export async function getFuturesPolicy(country: GlobalCountryId): Promise<FuturesPolicy | null> {
  const ref = todayISO();
  const ref30 = isoDaysAgo(30);
  const ref90 = isoDaysAgo(90);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const labels = {
    d0: `D+0 (${fmtRefDate(ref)})`,
    d30: `D-30 (${fmtRefDate(ref30)})`,
    d90: `D-90 (${fmtRefDate(ref90)})`,
  };

  if (country === "us") {
    // Começa no PRÓXIMO mês (o do mês corrente está expirando). 14 meses = horizonte líquido.
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const contracts = await fetchStripHistories(monthlySchedule(next.year, next.month, 14), "ZQ", "CBT");
    if (contracts.length < 3) return null;
    const p0 = fedFundsImpliedPath(stripAt(contracts, ref), FOMC_DECISION_DATES, ref);
    if (p0.length === 0) return null;
    const p30 = fedFundsImpliedPath(stripAt(contracts, ref30), FOMC_DECISION_DATES, ref);
    const p90 = fedFundsImpliedPath(stripAt(contracts, ref90), FOMC_DECISION_DATES, ref);
    return {
      label: "Fed implícita (futuros)",
      bank: "Fed",
      rows: buildPolicyRows(p0, p30, p90),
      labels,
      meetings: futureMeetings(FOMC_DECISION_DATES, ref),
      asOf: ref,
      note:
        "Trajetória implícita do Fed precificada pelos FUTUROS de Fed Funds de 30 dias (CBOT, via Yahoo ~15 min) — a " +
        "MESMA fonte do CME FedWatch. Cada contrato mensal liquida pela média da Fed Funds effective no mês; decompondo " +
        "os meses com reunião do FOMC isola-se a taxa esperada após cada decisão. D-30/D-90: a mesma tira precificada há " +
        "~30 e ~90 dias (mostra como a expectativa se moveu). Taxa = 100 − preço.",
    };
  }

  if (country === "de" || country === "jp") {
    // €STR/TONA futures no Yahoo são SNAPSHOT (sem série histórica), então não dá
    // p/ reconstruir D-30/D-90 deles. Usamos a curva curta OFICIAL (que TEM histórico
    // diário): DE = curva AAA da zona do euro (proxy €STR/OIS); JP = JGB curto (MOF).
    const isDe = country === "de";
    const curveAt = isDe ? await fetchEcbShortHistory() : await fetchJgbShortHistory();
    const cbDates = isDe ? ECB_DECISION_DATES : BOJ_DECISION_DATES;
    // JP: horizonte mais longo (a curva de JGB só mostra a alta do BoJ ao passar de
    // ~1 ano, onde o 2a > 1a); DE: ~1,5 ano (curva AAA vai até 3a).
    const opts = { stepPct: 0, horizonYears: isDe ? 1.5 : 1.8 };
    const c0 = curveAt(ref);
    if (c0.length < 2) return null;
    const p0 = impliedPolicyPath(c0, ref, cbDates, opts);
    if (p0.length === 0) return null;
    const p30 = impliedPolicyPath(curveAt(ref30), ref, cbDates, opts);
    const p90 = impliedPolicyPath(curveAt(ref90), ref, cbDates, opts);
    return {
      label: isDe ? "BCE implícita" : "BoJ implícita",
      bank: isDe ? "BCE" : "BoJ",
      rows: buildPolicyRows(p0, p30, p90),
      labels,
      meetings: futureMeetings(cbDates, ref),
      asOf: ref,
      note: isDe
        ? "Trajetória implícita do BCE pela curva AAA curta da zona do euro (BCE Data Portal, 3m–3a) — proxy da €STR/OIS; os futuros €STR do Yahoo não trazem histórico. Forward entre reuniões do BCE. D-30/D-90: a mesma curva há ~30 e ~90 dias."
        : "Trajetória implícita do BoJ pela curva curta de JGB (Ministério das Finanças, a partir de 1 ano — o Japão não tem sub-1a nem futuros TONA com histórico gratuito). Forward entre reuniões do BoJ; resolução limitada no 1º ano (a curva de JGB é rasa no curtíssimo prazo). D-30/D-90: a mesma curva há ~30 e ~90 dias.",
    };
  }

  if (country === "co") {
    // Colômbia: a ponta curta é o IBR (Indicador Bancario de Referencia) —
    // overnight + 1m/3m/6m/12m formados pelos swaps IBR (o OIS colombiano),
    // publicados diariamente pelo BanRep (D-1, sem o lag da carga dos TES).
    // Mesmo modelo forward do BCE/BoJ, alinhado às decisões da Junta.
    // (Os betas Nelson-Siegel do SUAMECA vêm arredondados a 2 casas — precisão
    // insuficiente p/ a ponta curta; o IBR é a fonte correta.)
    const IBR: { idSerie: number; years: number }[] = [
      { idSerie: 15324, years: 1 / 365 }, // overnight (âncora do nível vigente)
      { idSerie: 15325, years: 1 / 12 },
      { idSerie: 15326, years: 0.25 },
      { idSerie: 16561, years: 0.5 },
      { idSerie: 16563, years: 1 },
    ];
    const bySeries = await fetchBanrepSeries(
      IBR.map((s) => s.idSerie),
      isoDaysAgo(130),
      FUTURES_HISTORY_REVALIDATE,
    );
    const hists = IBR.map((s) => ({ years: s.years, hist: bySeries.get(s.idSerie) ?? [] }));
    if (hists.filter((h) => h.hist.length > 0).length < 3) return null;
    const curveAt = (iso: string): CurvePoint[] =>
      hists
        .map((h) => {
          const r = valueOnOrBefore(h.hist, iso);
          return r == null ? null : { years: h.years, rate: r };
        })
        .filter((p): p is CurvePoint => p != null)
        .sort((a, b) => a.years - b.years);
    const opts = { stepPct: 0.25, horizonYears: 1.0 }; // IBR só vai a 12m
    const c0 = curveAt(ref);
    if (c0.length < 2) return null;
    const p0 = impliedPolicyPath(c0, ref, BANREP_DECISION_DATES, opts);
    if (p0.length === 0) return null;
    const p30 = impliedPolicyPath(curveAt(ref30), ref, BANREP_DECISION_DATES, opts);
    const p90 = impliedPolicyPath(curveAt(ref90), ref, BANREP_DECISION_DATES, opts);
    return {
      label: "BanRep implícita (IBR)",
      bank: "BanRep",
      rows: buildPolicyRows(p0, p30, p90),
      labels,
      meetings: futureMeetings(BANREP_DECISION_DATES, ref),
      asOf: ref,
      note:
        "Trajetória implícita do BanRep pela curva do IBR (Indicador Bancario de Referencia, overnight a 12 meses — " +
        "formado pelos swaps IBR, o análogo colombiano do DI/OIS; BanRep, D-1). Forward entre as decisões de taxa da " +
        "Junta Directiva (8/ano; calendário 2027 estimado), degraus de 0,25 p.p., horizonte ~12 meses. D-30/D-90: a " +
        "mesma curva há ~30 e ~90 dias.",
    };
  }

  // gb: sem tira de SONIA gratuita → curva-only (a antiga aproximação Bank
  // Rate + 1 forward era uma linha chapada sem informação).
  return null;
}
