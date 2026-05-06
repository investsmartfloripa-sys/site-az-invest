import Link from "next/link";

import { PostCard } from "@/components/common/PostCard";
import { CommunityCallout } from "@/components/home/CommunityCallout";
import { PainelPanoramaSection } from "@/components/painel/PainelPanoramaSection";
import { StaticChartCard } from "@/components/painel/StaticChartCard";
import { getPanoramaData, painelBlobConfigured } from "@/lib/painel-data";
import { findPosts, mapPost } from "@/lib/posts";

type TableRow = Record<string, string | number | null>;

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstRateValue(row: TableRow | undefined): number | null {
  if (!row) return null;
  const keyPriority = ["taxa", "rate", "selic", "yield", "retorno"];

  for (const [key, value] of Object.entries(row)) {
    if (keyPriority.some((token) => key.toLowerCase().includes(token))) {
      const parsed = parseNumber(value);
      if (parsed != null) return parsed;
    }
  }

  for (const value of Object.values(row)) {
    const parsed = parseNumber(value);
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
  const posts = await findPosts({
    where: { published: true, category: "Economia" },
    orderBy: { createdAt: "desc" },
  });
  const mapped = posts.map(mapPost);
  const data = await getPanoramaData();

  const blobConfigured = painelBlobConfigured();
  const chartCacheBuster =
    data.tablePrefixado.meta.generatedAt ??
    data.tableIpca.meta.generatedAt ??
    data.tableSelic.meta.generatedAt ??
    data.tableTreasury.meta.generatedAt ??
    "1";

  const metricCards = [
    { title: "Cambio (dia)", value: formatPct(data.fxData.data?.top?.day?.up?.[0]?.change_pct ?? null) },
    {
      title: "Selic implicita",
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
      title: "Indices globais (1M)",
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
          Configure <code className="rounded bg-white px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> no ambiente para carregar
          JSONs e SVGs do painel.
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
            Abrir trilha de politica monetaria
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <StaticChartCard
            slug="juros_prefixado_v2"
            title="Curva prefixado"
            subtitle="Curvas historicas (D-90, D-30 e Hoje)"
            badge="BCB / Tesouro"
            cacheBuster={chartCacheBuster}
            tableData={data.tablePrefixado.data}
          />
          <StaticChartCard
            slug="juros_ipca_v2"
            title="Curva IPCA+"
            subtitle="Curvas historicas (D-90, D-30 e Hoje)"
            badge="Tesouro"
            cacheBuster={chartCacheBuster}
            tableData={data.tableIpca.data}
          />
          <StaticChartCard
            slug="selic_implicita_v2"
            title="Selic implicita (forward)"
            subtitle="Serie projetada de 12 meses (Hoje, 30d e 90d)"
            badge="B3 PRE"
            cacheBuster={chartCacheBuster}
            tableData={data.tableSelic.data}
          />
          <StaticChartCard
            slug="juros_treasury_us_v2"
            title="Curva Treasury EUA"
            subtitle="Curvas historicas (D-365, D-90, D-30 e Hoje)"
            badge="FRED"
            cacheBuster={chartCacheBuster}
            tableData={data.tableTreasury.data}
          />
        </div>
      </section>

      <section id="analises" className="space-y-4">
        <h3 className="text-2xl text-[#027DFC]">Analises recentes</h3>
        {mapped.length === 0 ? (
          <p className="rounded-xl border border-[#132960]/20 bg-white p-6 text-sm text-zinc-600">
            Nenhuma analise publicada nessa categoria ainda.
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
