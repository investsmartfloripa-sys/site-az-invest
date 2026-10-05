/**
 * Fetchers SERVER-ONLY das taxas básicas de juros (ver `policy-rates.ts`).
 *
 *   - BIS WS_CBPOL: https://stats.bis.org/api/v1/data/WS_CBPOL/D.{CC}/all
 *     ?format=csv&detail=dataonly — CSV "FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE",
 *     uma linha por dia CORRIDO; fins de semana/feriados vêm como "NaN" (sem
 *     descartar, cada fim de semana vira duas "mudanças" falsas). Defasagem de
 *     ~1 semana. ~200 KB por país desde 2000 (cabe no Data Cache, < 2 MB).
 *   - BCE (só Zona do Euro): taxa de depósito FM.D.U2.EUR.4F.KR.DFR.LEV, diária
 *     corrida, atualizada no próprio dia. Se falhar, cai p/ o BIS a partir de
 *     18/09/2024 (quando o BIS passa a publicar a própria taxa de depósito).
 *
 * Cada série é comprimida p/ PONTOS DE MUDANÇA (a taxa é um degrau) — o cliente
 * recebe poucos KB. Falha de um país vira `missing`, nunca derruba os demais.
 */

import "server-only";

import {
  POLICY_HISTORY_START,
  POLICY_RATE_COUNTRIES,
  type PolicyRateCountry,
  type PolicyRateSeries,
  type PolicyRatesPayload,
  type PolicyStep,
} from "@/lib/policy-rates";

const UA = "Mozilla/5.0 (compatible; AZInvestBot/1.0; +https://investimentosdeaz.com.br)";

/** 6 h — o BIS atualiza 1x/semana; o cache segura o último bom se a fonte cair. */
const POLICY_REVALIDATE = 21_600;

const BIS_BASE = "https://stats.bis.org/api/v1/data/WS_CBPOL";
const ECB_DFR_URL = "https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV";
/** Data em que o BIS troca MRO → taxa de depósito na Zona do Euro. */
const BIS_XM_DFR_FROM = "2024-09-18";

async function fetchText(url: string, timeoutMs = 25_000): Promise<string | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      next: { revalidate: POLICY_REVALIDATE },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/**
 * CSV (sem campos entre aspas — modo dataonly) → observações [data, valor]
 * ordenadas, descartando "NaN"/vazios. Acha as colunas pelo cabeçalho.
 */
function parseObs(csv: string | null): [string, number][] {
  if (!csv) return [];
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(",");
  const iT = head.indexOf("TIME_PERIOD");
  const iV = head.indexOf("OBS_VALUE");
  if (iT < 0 || iV < 0) return [];
  const out: [string, number][] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const d = c[iT];
    const v = Number.parseFloat(c[iV]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "") || !Number.isFinite(v)) continue;
    out.push([d, v]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

/** Observações diárias → degraus (só as datas em que a taxa mudou). */
function toSteps(obs: [string, number][], since?: string): PolicyStep[] {
  const steps: PolicyStep[] = [];
  let prev = Number.NaN;
  for (const [d, v] of obs) {
    if (since && d < since) continue;
    const r = Math.round(v * 1000) / 1000;
    if (r !== prev) {
      steps.push([d, r]);
      prev = r;
    }
  }
  return steps;
}

function lastDate(obs: [string, number][], since?: string): string | null {
  const last = obs[obs.length - 1]?.[0];
  if (!last || (since && last < since)) return null;
  return last;
}

async function fetchBis(c: PolicyRateCountry, since?: string): Promise<PolicyRateSeries | null> {
  const csv = await fetchText(
    `${BIS_BASE}/D.${c.bis}/all?format=csv&detail=dataonly&startPeriod=${POLICY_HISTORY_START}`,
  );
  const obs = parseObs(csv);
  const asOf = lastDate(obs, since);
  const steps = toSteps(obs, since);
  if (!asOf || steps.length === 0) return null;
  return { id: c.id, asOf, source: "BIS", steps };
}

async function fetchEuroArea(c: PolicyRateCountry): Promise<PolicyRateSeries | null> {
  const csv = await fetchText(
    `${ECB_DFR_URL}?format=csvdata&detail=dataonly&startPeriod=${POLICY_HISTORY_START}`,
  );
  const obs = parseObs(csv);
  const asOf = lastDate(obs);
  const steps = toSteps(obs);
  if (asOf && steps.length > 0) return { id: c.id, asOf, source: "BCE", steps };
  // Fallback: BIS só a partir da troca p/ a taxa de depósito (antes é MRO).
  return fetchBis(c, BIS_XM_DFR_FROM);
}

/** Todas as taxas básicas do catálogo, em paralelo. */
export async function getPolicyRates(): Promise<PolicyRatesPayload> {
  const results = await Promise.all(
    POLICY_RATE_COUNTRIES.map((c) =>
      (c.id === "xm" ? fetchEuroArea(c) : fetchBis(c, c.since)).catch(() => null),
    ),
  );
  const series: PolicyRateSeries[] = [];
  const missing: PolicyRatesPayload["missing"] = [];
  results.forEach((r, i) => {
    if (r) series.push(r);
    else missing.push(POLICY_RATE_COUNTRIES[i].id);
  });
  return { generatedAt: new Date().toISOString(), series, missing };
}
