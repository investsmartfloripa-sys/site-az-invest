import Link from "next/link";

import { PostCard } from "@/components/common/PostCard";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import {
  JurosLiveBlock,
  type CurveCut,
  type SelicMeeting,
  type TreasuryTenor,
} from "@/components/painel/panorama/JurosLiveBlock";
import { KpiStrip, type KpiCard } from "@/components/painel/panorama/KpiStrip";
import { MarketTape, type TapeItem } from "@/components/painel/panorama/MarketTape";
import { PanoramaResumo } from "@/components/painel/panorama/PanoramaResumo";
import { PainelPanoramaSection } from "@/components/painel/PainelPanoramaSection";
import { getPanoramaData, painelBlobConfigured, type PanoramaData } from "@/lib/painel-data";
import { findPosts, mapPost } from "@/lib/posts";

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (/^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(s)) return null;
  if (!/[.,%]/.test(s)) return null;
  const hasComma = s.includes(",");
  const normalized = hasComma
    ? s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
    : s.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function fmtSignedPct(value: number | null): string | null {
  if (value == null) return null;
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2).replace(".", ",")}%`;
}

function directionOf(changePct: number | null, flatBand = 0.03): KpiCard["direction"] {
  if (changePct == null || !Number.isFinite(changePct)) return null;
  if (Math.abs(changePct) < flatBand) return "flat";
  return changePct > 0 ? "up" : "down";
}

/** Linha 1d do asset panorama por nome (retorno % e nivel last_close). */
function asset1d(data: PanoramaData, needle: string): { pct: number | null; level: number | null } {
  const rows = data.assetPanorama.data?.by_period?.["1d"]?.data ?? [];
  for (const row of rows) {
    const name = String(row.name ?? "");
    if (name.toLowerCase().includes(needle.toLowerCase())) {
      const p = row.return_brl_pct;
      const l = row.last_close;
      return {
        pct: typeof p === "number" ? p : Number.isFinite(Number(p)) ? Number(p) : null,
        level: typeof l === "number" ? l : Number.isFinite(Number(l)) ? Number(l) : null,
      };
    }
  }
  return { pct: null, level: null };
}

function commodity1d(data: PanoramaData, needle: string): number | null {
  const rows = data.commPanorama.data?.by_period?.["1d"]?.data ?? [];
  for (const row of rows) {
    const name = String(row.name ?? "");
    if (name.toLowerCase().includes(needle.toLowerCase())) {
      const v = (row as Record<string, unknown>).return_pct_usd ?? (row as Record<string, unknown>).return_pct_brl;
      const pct = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(pct)) return pct;
    }
  }
  return null;
}

/** Extrai um corte (coluna por prefixo) da tabela de curva pre do pipeline. */
function extractPreCut(data: PanoramaData, colPrefix: string): CurveCut[] {
  const table = data.tablePrefixado.data;
  const col = table?.columns?.find((c) => c.key.startsWith(colPrefix))?.key;
  if (!col) return [];
  const out: CurveCut[] = [];
  for (const row of table?.rows ?? []) {
    const venc = String(row.vencimento ?? "");
    const m = venc.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const rate = parseNumber(row[col]);
    if (rate == null) continue;
    out.push({ maturity: `${m[3]}-${m[2]}-${m[1]}`, rate });
  }
  return out;
}

/** Reunioes COPOM + cortes da selic implicita do pipeline (charts/tables/selic_implicita.json). */
function extractSelicMeetings(data: PanoramaData): SelicMeeting[] {
  const table = data.tableSelic.data;
  const cols = table?.columns ?? [];
  const keyOf = (prefix: string) => cols.find((c) => c.key.startsWith(prefix))?.key;
  const kRecent = keyOf("Recente") ?? keyOf("Hoje");
  const kD30 = keyOf("D-30");
  const kD90 = keyOf("D-90");
  const out: SelicMeeting[] = [];
  for (const row of table?.rows ?? []) {
    const first = String(Object.values(row)[0] ?? "");
    const m = first.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    out.push({
      date: `${m[3]}-${m[2]}-${m[1]}`,
      recent: kRecent ? parseNumber(row[kRecent]) : null,
      d30: kD30 ? parseNumber(row[kD30]) : null,
      d90: kD90 ? parseNumber(row[kD90]) : null,
    });
  }
  return out;
}

/** Curva Treasury por tenor com todos os cortes disponiveis. */
function extractTreasury(data: PanoramaData): TreasuryTenor[] {
  const table = data.tableTreasury.data;
  const cols = table?.columns ?? [];
  const keyOf = (prefix: string) => cols.find((c) => c.key.startsWith(prefix))?.key;
  const kRecent = keyOf("Recente") ?? keyOf("Hoje");
  const kD30 = keyOf("D-30");
  const kD90 = keyOf("D-90");
  const kD365 = keyOf("D-365");
  const out: TreasuryTenor[] = [];
  for (const row of table?.rows ?? []) {
    const tenor = Number(String(Object.values(row)[0] ?? "").trim());
    if (!Number.isFinite(tenor) || tenor <= 0) continue;
    out.push({
      tenor,
      recent: kRecent ? parseNumber(row[kRecent]) : null,
      d30: kD30 ? parseNumber(row[kD30]) : null,
      d90: kD90 ? parseNumber(row[kD90]) : null,
      d365: kD365 ? parseNumber(row[kD365]) : null,
    });
  }
  return out.sort((a, b) => a.tenor - b.tenor);
}

type SelicNow = { value: number; lastChangeBps: number; lastChangeDate: string } | null;

/**
 * Selic meta vigente + ultima mudanca do COPOM, via BCB SGS 432.
 * Server-side com revalidate de 1h; falha vira null (card mostra "—").
 */
async function fetchSelicAtual(): Promise<SelicNow> {
  try {
    const res = await fetch(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/400?formato=json",
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { data: string; valor: string }[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const last = rows[rows.length - 1];
    const lastVal = Number(last.valor);
    if (!Number.isFinite(lastVal)) return null;

    let changeDate = last.data;
    let prevVal: number | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = Number(rows[i].valor);
      if (!Number.isFinite(v)) continue;
      if (v !== lastVal) {
        prevVal = v;
        break;
      }
      changeDate = rows[i].data;
    }
    const bps = prevVal != null ? Math.round((lastVal - prevVal) * 100) : 0;
    const [, mm, yyyy] = changeDate.split("/");
    return { value: lastVal, lastChangeBps: bps, lastChangeDate: `${mm}/${yyyy.slice(2)}` };
  } catch {
    return null;
  }
}

function buildTapeItems(data: PanoramaData, brent: number | null, ouro: number | null): TapeItem[] {
  const items: TapeItem[] = [];
  const push = (label: string, pct: number | null) => {
    if (pct != null) items.push({ label, changePct: pct });
  };
  const usd = asset1d(data, "USD/BRL");
  if (usd.level != null) {
    items.push({ label: "USD/BRL", value: usd.level.toFixed(2).replace(".", ","), changePct: usd.pct });
  }
  push("S&P 500", asset1d(data, "S&P 500").pct);
  push("MSCI EM", asset1d(data, "Emergentes").pct);
  push("BRENT", brent);
  push("OURO", ouro);
  return items;
}

export async function PainelPanoramaPage() {
  let mapped: ReturnType<typeof mapPost>[] = [];
  try {
    const posts = await findPosts({
      where: { status: "APPROVED", published: true, category: "Economia" },
      orderBy: { createdAt: "desc" },
    });
    mapped = posts.map(mapPost);
  } catch (err) {
    console.error("[PainelPanoramaPage] findPosts falhou; seguindo sem analises", err);
  }
  const [data, selicAtual] = await Promise.all([getPanoramaData(), fetchSelicAtual()]);

  const blobConfigured = painelBlobConfigured();

  const blobJsonBlocks = [
    data.assetPanorama.data,
    data.worldPanorama.data,
    data.fxData.data,
    data.commPanorama.data,
    data.sectorGlobal.data,
    data.sectorBr.data,
    data.tablePrefixado.data,
    data.tableIpca.data,
    data.tableSelic.data,
    data.tableTreasury.data,
  ];
  const blobJsonLoadedCount = blobJsonBlocks.filter((d) => d != null).length;
  const blobDataAllMissing = blobConfigured && blobJsonLoadedCount === 0;
  const blobDataPartial =
    blobConfigured && blobJsonLoadedCount > 0 && blobJsonLoadedCount < blobJsonBlocks.length;

  const d30Pre = extractPreCut(data, "D-30");
  const d90Pre = extractPreCut(data, "D-90");
  const selicMeetings = extractSelicMeetings(data);
  const treasuryTenors = extractTreasury(data);

  const usd = asset1d(data, "USD/BRL");
  const sp = asset1d(data, "S&P 500");
  const brent = commodity1d(data, "Brent");
  const ouro = commodity1d(data, "Ouro");

  const tbill = treasuryTenors.find((t) => t.tenor === 1) ?? null;
  const t10 = treasuryTenors.find((t) => t.tenor === 10) ?? null;
  const tbillDeltaBps =
    tbill?.recent != null && tbill?.d30 != null ? Math.round((tbill.recent - tbill.d30) * 100) : null;
  const t10DeltaBps =
    t10?.recent != null && t10?.d30 != null ? Math.round((t10.recent - t10.d30) * 100) : null;

  const bpsChange = (bps: number | null): string | null =>
    bps == null ? null : `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${Math.abs(bps)} bps`;
  const bpsDirection = (bps: number | null): KpiCard["direction"] =>
    bps == null ? null : Math.abs(bps) < 1 ? "flat" : bps > 0 ? "up" : "down";

  // Ordem editorial fixa: Dolar · Bolsa · S&P · Selic · Tesouro 32 · T-bill · T10.
  // Bolsa e Tesouro 32 sao placeholders ate o live da B3 assumir no client.
  const kpiBase: KpiCard[] = [
    {
      id: "dolar",
      label: "Dólar (USD/BRL)",
      value: usd.level != null ? usd.level.toFixed(2).replace(".", ",") : "—",
      change: fmtSignedPct(usd.pct),
      direction: directionOf(usd.pct),
      sub: "spot · yfinance 15 min",
    },
    {
      id: "bolsa",
      label: "Ibovespa",
      value: "—",
      change: null,
      direction: null,
      sub: "carregando B3...",
    },
    {
      id: "sp500",
      label: "S&P 500 (IVVB11)",
      value: sp.level != null ? sp.level.toFixed(2).replace(".", ",") : "—",
      change: fmtSignedPct(sp.pct),
      direction: directionOf(sp.pct),
      sub: "BRL · yfinance 15 min",
    },
    {
      id: "selic",
      label: "Selic (meta)",
      value: selicAtual ? fmtPct(selicAtual.value) : "—",
      change: selicAtual && selicAtual.lastChangeBps !== 0 ? bpsChange(selicAtual.lastChangeBps) : null,
      direction: selicAtual ? bpsDirection(selicAtual.lastChangeBps) : null,
      sub: selicAtual ? `última mudança ${selicAtual.lastChangeDate} · BCB` : "BCB SGS",
    },
    {
      id: "tesouro32",
      label: "Tesouro 2032 (DI)",
      value: "—",
      change: null,
      direction: null,
      sub: "carregando B3...",
    },
    {
      id: "tbill",
      label: "Treasury 1 ano",
      value: tbill ? fmtPct(tbill.recent) : "—",
      change: bpsChange(tbillDeltaBps),
      direction: bpsDirection(tbillDeltaBps),
      sub: "vs D-30 · FRED D-1",
    },
    {
      id: "t10",
      label: "Treasury 10 anos",
      value: t10 ? fmtPct(t10.recent) : "—",
      change: bpsChange(t10DeltaBps),
      direction: bpsDirection(t10DeltaBps),
      sub: "vs D-30 · FRED D-1",
    },
  ];

  const tapeItems = buildTapeItems(data, brent, ouro);

  return (
    <div className="space-y-6">
      <MarketTape items={tapeItems} />

      {!blobConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> nas variaveis da Vercel e
          faca novo deploy para o site enxergar a URL publica do Blob.
        </p>
      ) : null}
      {blobDataAllMissing ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          O Blob esta configurado mas nenhum JSON foi carregado. Verifique a URL do store e se o data-pipeline
          gravou <code className="rounded bg-white px-1">data/*.json</code> e{" "}
          <code className="rounded bg-white px-1">charts/</code>.
        </p>
      ) : null}
      {blobDataPartial ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Alguns arquivos do Blob nao carregaram ({blobJsonLoadedCount} de {blobJsonBlocks.length} blocos).
          Regenere os dados ou confira se cada arquivo existe no store.
        </p>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-[#132960] md:text-3xl">Panorama</h1>
          <p className="text-sm text-zinc-500">
            Mercados, juros e setores em uma tela — com curvas DI e IPCA+ ao vivo da B3.
          </p>
        </div>
        <Link
          href="/painel-economico/mercado/brasil/renda-fixa"
          className="text-sm font-semibold text-[#027DFC] hover:underline"
        >
          Renda fixa completa →
        </Link>
      </header>

      <PanoramaResumo data={data} />

      <KpiStrip base={kpiBase} />

      <PainelPanoramaSection
        assetPanorama={data.assetPanorama.data}
        worldPanorama={data.worldPanorama.data}
        fxData={data.fxData.data}
        commPanorama={data.commPanorama.data}
        sectorGlobal={data.sectorGlobal.data}
        sectorBr={data.sectorBr.data}
      />

      <JurosLiveBlock
        d30Pre={d30Pre}
        d90Pre={d90Pre}
        selicMeetings={selicMeetings}
        treasuryTenors={treasuryTenors}
      />

      <section id="analises" className="space-y-4">
        <h2 className="text-xl font-semibold text-[#132960] md:text-2xl">Análises recentes</h2>
        {mapped.length === 0 ? (
          <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
            Nenhuma análise publicada nessa categoria ainda.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mapped.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="newsletter">
        <CommunityCallout />
      </section>
    </div>
  );
}
