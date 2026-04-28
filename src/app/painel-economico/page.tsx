import { Footer } from "@/components/common/Footer";
import { Header } from "@/components/common/Header";
import { PostCard } from "@/components/common/PostCard";
import type { FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import type { ByPeriodBlock } from "@/components/painel/DynamicReturnsBar";
import { PainelPanoramaSection } from "@/components/painel/PainelPanoramaSection";
import type { SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import type { SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";
import { FloatingSectionsMenu } from "@/components/painel/FloatingSectionsMenu";
import { StaticChartCard, type StaticChartTablePayload } from "@/components/painel/StaticChartCard";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { painelBlobBase, painelBlobUrl } from "@/lib/painel-blob";
import { findPosts, mapPost } from "@/lib/posts";

const REVALIDATE = 3600;

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type PanoramaByPeriod = { by_period?: ByPeriodBlock };

export default async function PainelEconomicoPage() {
  const posts = await findPosts({
    where: { published: true, category: "Economia" },
    orderBy: { createdAt: "desc" },
  });
  const mapped = posts.map(mapPost);

  const [assetPanorama, worldPanorama, fxData, commPanorama, sectorGlobal, sectorBr] = await Promise.all([
    fetchBlobJson<PanoramaByPeriod>("data/asset_returns_panorama.json"),
    fetchBlobJson<PanoramaByPeriod>("data/world_indices_returns_panorama.json"),
    fetchBlobJson<FxMoversPayload>("data/fx_top_movers.json"),
    fetchBlobJson<PanoramaByPeriod>("data/commodities_returns_panorama.json"),
    fetchBlobJson<SectorGlobalPayload>("data/sector_baskets_panorama.json"),
    fetchBlobJson<SectorBrPayload>("data/br_sector_baskets_panorama.json"),
  ]);
  const [tablePrefixado, tableIpca, tableSelic, tableTreasury] = await Promise.all([
    fetchBlobJson<StaticChartTablePayload>("charts/tables/juros_prefixado.json"),
    fetchBlobJson<StaticChartTablePayload>("charts/tables/juros_ipca.json"),
    fetchBlobJson<StaticChartTablePayload>("charts/tables/selic_implicita.json"),
    fetchBlobJson<StaticChartTablePayload>("charts/tables/juros_treasury_us.json"),
  ]);

  const blobConfigured = Boolean(painelBlobBase());
  // Rotaciona o query param por janela de revalidacao para evitar cache antigo dos SVGs.
  const chartCacheBuster = String(Math.floor(Date.now() / (REVALIDATE * 1000)));

  return (
    <div className="min-h-screen text-[#132960]">
      <Header />
      <FloatingSectionsMenu
        items={[
          { href: "#panorama", label: "Panorama" },
          { href: "#juros", label: "Juros" },
          { href: "#analises", label: "Analises" },
          { href: "#newsletter", label: "Newsletter" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#027DFC]">Economia</p>
          <h1 className="text-4xl text-[#027DFC] md:text-5xl">Painel economico</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Panorama de retornos, cambio, commodities, setores e curvas de juros. Dados atualizados pelo
            pipeline diario; graficos estaticos via R e interativos via Recharts.
          </p>
        </header>

        {!blobConfigured ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Configure <code className="rounded bg-white px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> no ambiente
            (URL publica do Vercel Blob) para carregar JSONs e SVGs do painel.
          </p>
        ) : null}

        <div id="panorama">
          <PainelPanoramaSection
            assetPanorama={assetPanorama}
            worldPanorama={worldPanorama}
            fxData={fxData}
            commPanorama={commPanorama}
            sectorGlobal={sectorGlobal}
            sectorBr={sectorBr}
          />
        </div>

        <section id="juros" className="space-y-4">
          <h2 className="text-2xl font-semibold text-[#027DFC]">Juros</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <StaticChartCard
              slug="juros_prefixado"
              title="Curva prefixado"
              badge="BCB / Tesouro"
              cacheBuster={chartCacheBuster}
              tableData={tablePrefixado}
            />
            <StaticChartCard
              slug="juros_ipca"
              title="Curva IPCA+"
              badge="Tesouro"
              cacheBuster={chartCacheBuster}
              tableData={tableIpca}
            />
            <StaticChartCard
              slug="selic_implicita"
              title="Selic implicita (forward)"
              badge="B3 PRE"
              cacheBuster={chartCacheBuster}
              tableData={tableSelic}
            />
            <StaticChartCard
              slug="juros_treasury_us"
              title="Curva Treasury EUA"
              badge="FRED"
              cacheBuster={chartCacheBuster}
              tableData={tableTreasury}
            />
          </div>
        </section>

        <section id="analises" className="space-y-4">
          <h2 className="text-2xl text-[#027DFC]">Analises recentes</h2>
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

        <div id="newsletter">
          <NewsletterForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
