import Link from "next/link";

import { PostCard } from "@/components/common/PostCard";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { DestaquesDaSemana } from "@/components/conteudo/DestaquesDaSemana";
import type { Row } from "@/components/painel/DynamicReturnsBar";
import { JurosLiveBlock } from "@/components/painel/panorama/JurosLiveBlock";
import { PainelPanoramaSection } from "@/components/painel/PainelPanoramaSection";
import { KpiStrip, type KpiCard } from "@/components/painel/panorama/KpiStrip";
import { LazyMount } from "@/components/painel/panorama/LazyMount";
import { MarketTape, type TapeItem } from "@/components/painel/panorama/MarketTape";
import { PanoramaResumo } from "@/components/painel/panorama/PanoramaResumo";
import { StaticChartCard } from "@/components/painel/StaticChartCard";
import { painelBlobUrl } from "@/lib/painel-blob";
import { getPanoramaData, painelBlobConfigured, type PanoramaData } from "@/lib/painel-data";
import { findPosts, mapPost } from "@/lib/posts";

type TableRow = Record<string, string | number | null>;

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

function firstRateValue(row: TableRow | undefined): number | null {
  if (!row) return null;
  const entries = Object.entries(row);
  const ratePattern = /(taxa|rate|selic|yield|retorno|recente|hoje)/i;
  for (const [key, value] of entries) {
    if (ratePattern.test(key)) {
      const parsed = parseNumber(value);
      if (parsed != null) return parsed;
    }
  }
  for (let i = entries.length - 1; i > 0; i--) {
    const parsed = parseNumber(entries[i][1]);
    if (parsed != null) return parsed;
  }
  return null;
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

/** Retorno 1d (em BRL) de um ativo do asset panorama, por nome. */
function assetReturn1d(data: PanoramaData, needle: string): number | null {
  const rows = data.assetPanorama.data?.by_period?.["1d"]?.data ?? [];
  for (const row of rows) {
    const name = String(row.name ?? "");
    if (name.toLowerCase().includes(needle.toLowerCase())) {
      const v = row.return_brl_pct;
      const pct = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(pct)) return pct;
    }
  }
  return null;
}

function commodityReturn1d(data: PanoramaData, needle: string): number | null {
  const rows = data.commPanorama.data?.by_period?.["1d"]?.data ?? [];
  for (const row of rows) {
    const name = String(row.name ?? "");
    if (name.toLowerCase().includes(needle.toLowerCase())) {
      const v = (row as Row).return_pct_usd ?? (row as Row).return_pct_brl;
      const pct = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(pct)) return pct;
    }
  }
  return null;
}

/**
 * Extrai a curva pre D-30 da tabela do pipeline (TaxaSwap, D-1) para
 * sobrepor como serie historica no bloco de juros ao vivo.
 */
function extractD30Pre(data: PanoramaData): { maturity: string; rate: number }[] {
  const table = data.tablePrefixado.data;
  const d30Col = table?.columns?.find((c) => c.key.startsWith("D-30"))?.key;
  if (!d30Col) return [];
  const out: { maturity: string; rate: number }[] = [];
  for (const row of table?.rows ?? []) {
    const venc = String(row.vencimento ?? "");
    const m = venc.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const rate = parseNumber(row[d30Col]);
    if (rate == null) continue;
    out.push({ maturity: `${m[3]}-${m[2]}-${m[1]}`, rate });
  }
  return out;
}

function buildTapeItems(data: PanoramaData, selicImplicita: number | null): TapeItem[] {
  const items: TapeItem[] = [];

  const push = (label: string, pct: number | null) => {
    if (pct != null) items.push({ label, changePct: pct });
  };

  push("BOLSA BR (EWZ)", assetReturn1d(data, "EWZ"));
  push("S&P 500", assetReturn1d(data, "S&P 500"));
  push("USD/BRL", assetReturn1d(data, "USD/BRL"));
  push("MSCI EM", assetReturn1d(data, "Emergentes"));
  push("BRENT", commodityReturn1d(data, "Brent"));
  push("OURO", commodityReturn1d(data, "Ouro"));

  if (selicImplicita != null) {
    items.push({ label: "SELIC IMPL.", value: formatPct(selicImplicita), changePct: null });
  }

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
  const data = await getPanoramaData();

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

  const chartCacheBuster =
    data.tablePrefixado.meta.generatedAt ??
    data.tableIpca.meta.generatedAt ??
    data.tableSelic.meta.generatedAt ??
    data.tableTreasury.meta.generatedAt ??
    "1";

  const selicImplicita = firstRateValue(data.tableSelic.data?.rows?.[0] as TableRow | undefined);
  const treasury10y = firstRateValue(
    (data.tableTreasury.data?.rows ?? []).find((r) => {
      const first = Object.values(r)[0];
      return String(first).trim() === "10";
    }) as TableRow | undefined,
  );

  const tapeItems = buildTapeItems(data, selicImplicita);
  const d30Pre = extractD30Pre(data);

  const ewz = assetReturn1d(data, "EWZ");
  const usdbrl = assetReturn1d(data, "USD/BRL");
  const spx = assetReturn1d(data, "S&P 500");
  const brent = commodityReturn1d(data, "Brent");

  const kpiBase: KpiCard[] = [
    {
      label: "Bolsa Brasil (EWZ)",
      value: ewz != null ? `${ewz >= 0 ? "+" : ""}${ewz.toFixed(2).replace(".", ",")}%` : "—",
      sub: "1 dia · em BRL",
      changePct: null,
      accent: ewz == null ? "neutral" : ewz >= 0 ? "up" : "down",
    },
    {
      label: "Dólar (USD/BRL)",
      value: usdbrl != null ? `${usdbrl >= 0 ? "+" : ""}${usdbrl.toFixed(2).replace(".", ",")}%` : "—",
      sub: "variação 1 dia",
      changePct: null,
      accent: usdbrl == null ? "neutral" : usdbrl >= 0 ? "down" : "up",
    },
    {
      label: "S&P 500",
      value: spx != null ? `${spx >= 0 ? "+" : ""}${spx.toFixed(2).replace(".", ",")}%` : "—",
      sub: "1 dia · em BRL",
      changePct: null,
      accent: spx == null ? "neutral" : spx >= 0 ? "up" : "down",
    },
    {
      label: "Selic implícita",
      value: formatPct(selicImplicita),
      sub: "próxima reunião · B3 D-1",
      changePct: null,
      accent: "info",
    },
    {
      label: "Treasury 10 anos",
      value: formatPct(treasury10y),
      sub: "FRED · D-1",
      changePct: null,
      accent: "info",
    },
    {
      label: "Brent",
      value: brent != null ? `${brent >= 0 ? "+" : ""}${brent.toFixed(2).replace(".", ",")}%` : "—",
      sub: "1 dia · em USD",
      changePct: null,
      accent: brent == null ? "neutral" : brent >= 0 ? "up" : "down",
    },
  ];

  return (
    <div className="space-y-6">
      {!blobConfigured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> nas variaveis da Vercel e
          faca novo deploy para o site enxergar a URL publica do Blob. Opcional no servidor:{" "}
          <code className="rounded bg-white px-1">PAINEL_BLOB_PUBLIC_FALLBACK</code> com a mesma URL se o build
          tiver ficado sem a variavel NEXT_PUBLIC.
        </p>
      ) : null}
      {blobDataAllMissing ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          O Blob esta configurado mas nenhum JSON foi carregado. Verifique a URL do store e se o data-pipeline
          gravou <code className="rounded bg-white px-1">data/*.json</code> e{" "}
          <code className="rounded bg-white px-1">charts/</code>; confira tambem 403/404 nos logs da Vercel.
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

      <MarketTape items={tapeItems} />

      <PanoramaResumo data={data} />

      <KpiStrip base={kpiBase} />

      <JurosLiveBlock d30Pre={d30Pre} />

      <PainelPanoramaSection
        assetPanorama={data.assetPanorama.data}
        worldPanorama={data.worldPanorama.data}
        fxData={data.fxData.data}
        commPanorama={data.commPanorama.data}
        sectorGlobal={data.sectorGlobal.data}
        sectorBr={data.sectorBr.data}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#132960] md:text-2xl">Juros — fechamento D-1</h2>
          <Link
            href="/painel-economico/economia/brasil/politica-monetaria"
            className="text-sm text-[#027DFC] hover:underline"
          >
            Trilha de política monetária →
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <LazyMount minHeight={420}>
            <StaticChartCard
              slug="selic_implicita"
              svgPublicSrc={painelBlobUrl("charts/static/selic_implicita.svg")}
              title="Selic implícita (forward)"
              subtitle="Série projetada de 12 meses (Recente, D-30 e D-90)"
              badge="B3 PRE"
              cacheBuster={chartCacheBuster}
              tableData={data.tableSelic.data}
            />
          </LazyMount>
          <LazyMount minHeight={420}>
            <StaticChartCard
              slug="juros_treasury_us"
              svgPublicSrc={painelBlobUrl("charts/static/juros_treasury_us.svg")}
              title="Curva Treasury EUA"
              subtitle="Curvas históricas (D-365, D-90, D-30 e Recente)"
              badge="FRED"
              cacheBuster={chartCacheBuster}
              tableData={data.tableTreasury.data}
            />
          </LazyMount>
        </div>
        <p className="text-xs text-zinc-400">
          As curvas prefixada e IPCA+ D-1 completas (com tabelas por vencimento) seguem na trilha{" "}
          <Link href="/painel-economico/mercado/brasil/renda-fixa" className="text-[#027DFC] hover:underline">
            renda fixa
          </Link>
          .
        </p>
      </section>

      <DestaquesDaSemana />

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
