import Link from "next/link";

import { PostCard } from "@/components/common/PostCard";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { PainelPanoramaSection } from "@/components/painel/PainelPanoramaSection";
import { StaticChartCard } from "@/components/painel/StaticChartCard";
import { painelBlobUrl } from "@/lib/painel-blob";
import { getPanoramaData, painelBlobConfigured } from "@/lib/painel-data";
import { findPosts, mapPost } from "@/lib/posts";

type TableRow = Record<string, string | number | null>;

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  // Rejeita data tipo "08/05/2026" ou "2026-05-08" (evita que vire 8052026).
  if (/^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(s)) return null;
  // Exige separador decimal (.,) ou símbolo de percentual — descarta ID/tenor tipo "1", "10", "30".
  if (!/[.,%]/.test(s)) return null;
  // Se tem vírgula, é formato BR (ponto = milhar). Senão, ponto = decimal (formato US).
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

  // Procura colunas que sugiram taxa/curva (inclui "Hoje (DD/MM/YYYY)" usado no pipeline atual).
  const ratePattern = /(taxa|rate|selic|yield|retorno|hoje)/i;
  for (const [key, value] of entries) {
    if (ratePattern.test(key)) {
      const parsed = parseNumber(value);
      if (parsed != null) return parsed;
    }
  }

  // Fallback: pega o último valor da linha (curva mais recente por convenção do pipeline).
  // Nunca o primeiro, que é sempre a coluna de data/vencimento/tenor.
  for (let i = entries.length - 1; i > 0; i--) {
    const parsed = parseNumber(entries[i][1]);
    if (parsed != null) return parsed;
  }

  return null;
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function firstNumericFromObject(obj: Record<string, unknown> | null | undefined, keyHints: string[]): number | null {
  if (!obj) return null;

  for (const [key, value] of Object.entries(obj)) {
    if (keyHints.some((hint) => key.toLowerCase().includes(hint))) {
      const parsed = parseNumber(value as string | number | null | undefined);
      if (parsed != null) return parsed;
    }
  }

  for (const value of Object.values(obj)) {
    const parsed = parseNumber(value as string | number | null | undefined);
    if (parsed != null) return parsed;
  }

  return null;
}

function firstReturnFromPeriod(
  byPeriod: Record<string, { data?: Record<string, unknown>[] }> | undefined,
  period: string,
  keyHints: string[],
): number | null {
  const row = byPeriod?.[period]?.data?.[0];
  return firstNumericFromObject(row, keyHints);
}

export async function PainelPanoramaPage() {
  // Tolera DB indisponivel (ex.: preview sem DATABASE_URL): renderiza painel sem "Analises recentes".
  let mapped: ReturnType<typeof mapPost>[] = [];
  try {
    const posts = await findPosts({
      where: { published: true, category: "Economia" },
      orderBy: { createdAt: "desc" },
    });
    mapped = posts.map(mapPost);
  } catch (err) {
    console.error("[PainelPanoramaPage] findPosts falhou; seguindo sem analises", err);
  }
  const data = await getPanoramaData();

  const blobConfigured = painelBlobConfigured();

  /** Quantos dos 10 JSONs do Blob responderam com conteudo (evita alerta falso). */
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

  const metricCards = [
    { title: "Câmbio (dia)", value: formatPct(data.fxData.data?.top?.day?.up?.[0]?.change_pct ?? null) },
    {
      title: "Selic implícita",
      value: formatPct(firstRateValue(data.tableSelic.data?.rows?.[0] as TableRow | undefined)),
    },
    {
      title: "Prefixado BR",
      value: formatPct(firstRateValue(data.tablePrefixado.data?.rows?.[0] as TableRow | undefined)),
    },
    {
      title: "Treasury EUA",
      value: formatPct(firstRateValue(data.tableTreasury.data?.rows?.[0] as TableRow | undefined)),
    },
    {
      title: "Commodities (1M)",
      value: formatPct(firstReturnFromPeriod(data.commPanorama.data?.by_period, "1mo", ["return_pct_brl", "return_pct", "return"])),
    },
    {
      title: "Índices globais (1M)",
      value: formatPct(firstReturnFromPeriod(data.worldPanorama.data?.by_period, "1mo", ["return_pct", "return"])),
    },
    {
      title: "Setor BR top (1M)",
      value: formatPct(data.sectorBr.data?.by_period?.["1mo"]?.data?.top10?.[0]?.return_pct ?? null),
    },
    {
      title: "Setor global top (1M)",
      value: formatPct(data.sectorGlobal.data?.by_period?.["1mo"]?.view_usd?.top10?.[0]?.return_pct ?? null),
    },
  ];

  return (
    <div className="space-y-8">
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
          Alguns arquivos do Blob nao carregaram ({blobJsonLoadedCount} de {blobJsonBlocks.length} blocos). Os
          graficos vazios tendem a corresponder a JSON em falta ou pipeline desatualizado — regenere os dados ou
          confira se cada arquivo existe no store (ex.:{" "}
          <code className="rounded bg-white px-1">data/asset_returns_panorama.json</code>,{" "}
          <code className="rounded bg-white px-1">data/fx_top_movers.json</code>, tabelas em{" "}
          <code className="rounded bg-white px-1">charts/tables/</code>).
        </p>
      ) : null}

      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-[#132960]/15 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{card.title}</p>
              <p className="mt-1 text-2xl font-semibold text-[#132960]">{card.value}</p>
            </article>
          ))}
        </div>
      </section>

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
          <h3 className="text-2xl font-semibold text-[#027DFC]">Juros</h3>
          <Link href="/painel-economico/economia/brasil/politica-monetaria" className="text-sm text-[#027DFC] hover:underline">
            Abrir trilha de política monetária
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <StaticChartCard
            slug="juros_prefixado"
            svgPublicSrc={painelBlobUrl("charts/static/juros_prefixado.svg")}
            title="Curva prefixado"
            subtitle="Curvas históricas (D-90, D-30 e Hoje)"
            badge="BCB / Tesouro"
            cacheBuster={chartCacheBuster}
            tableData={data.tablePrefixado.data}
          />
          <StaticChartCard
            slug="juros_ipca"
            svgPublicSrc={painelBlobUrl("charts/static/juros_ipca.svg")}
            title="Curva IPCA+"
            subtitle="Curvas históricas (D-90, D-30 e Hoje)"
            badge="Tesouro"
            cacheBuster={chartCacheBuster}
            tableData={data.tableIpca.data}
          />
          <StaticChartCard
            slug="selic_implicita"
            svgPublicSrc={painelBlobUrl("charts/static/selic_implicita.svg")}
            title="Selic implícita (forward)"
            subtitle="Série projetada de 12 meses (Hoje, 30d e 90d)"
            badge="B3 PRE"
            cacheBuster={chartCacheBuster}
            tableData={data.tableSelic.data}
          />
          <StaticChartCard
            slug="juros_treasury_us"
            svgPublicSrc={painelBlobUrl("charts/static/juros_treasury_us.svg")}
            title="Curva Treasury EUA"
            subtitle="Curvas históricas (D-365, D-90, D-30 e Hoje)"
            badge="FRED"
            cacheBuster={chartCacheBuster}
            tableData={data.tableTreasury.data}
          />
        </div>
      </section>

      <section id="analises" className="space-y-4">
        <h3 className="text-2xl text-[#027DFC]">Análises recentes</h3>
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
