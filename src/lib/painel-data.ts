import type { FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import type { ByPeriodBlock } from "@/components/painel/DynamicReturnsBar";
import type { SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import type { SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";
import type { StaticChartTablePayload } from "@/components/painel/StaticChartCard";
import { painelBlobBase, painelBlobUrl } from "@/lib/painel-blob";

export const PAINEL_REVALIDATE_SECONDS = 900;

export type DataFrequency = "tempo-real" | "diario" | "semanal" | "mensal";

export type WidgetMeta = {
  key: string;
  title: string;
  source: string;
  frequency: DataFrequency;
  generatedAt?: string;
};

export type BlobWidgetPayload<T> = {
  meta: WidgetMeta;
  data: T | null;
};

export type PanoramaByPeriod = { generated_at?: string; by_period?: ByPeriodBlock };

export type PanoramaData = {
  assetPanorama: BlobWidgetPayload<PanoramaByPeriod>;
  worldPanorama: BlobWidgetPayload<PanoramaByPeriod>;
  fxData: BlobWidgetPayload<FxMoversPayload>;
  commPanorama: BlobWidgetPayload<PanoramaByPeriod>;
  sectorGlobal: BlobWidgetPayload<SectorGlobalPayload>;
  sectorBr: BlobWidgetPayload<SectorBrPayload>;
  tablePrefixado: BlobWidgetPayload<StaticChartTablePayload>;
  tableIpca: BlobWidgetPayload<StaticChartTablePayload>;
  tableSelic: BlobWidgetPayload<StaticChartTablePayload>;
  tableTreasury: BlobWidgetPayload<StaticChartTablePayload>;
};

async function fetchBlobJson<T>(path: string): Promise<T | null> {
  const url = painelBlobUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: PAINEL_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function createWidget<T>(
  key: string,
  title: string,
  source: string,
  frequency: DataFrequency,
  generatedAt: string | undefined,
  data: T | null,
): BlobWidgetPayload<T> {
  return {
    meta: { key, title, source, frequency, generatedAt },
    data,
  };
}

export async function getPanoramaData(): Promise<PanoramaData> {
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

  return {
    assetPanorama: createWidget(
      "asset_returns",
      "Retornos dos ativos",
      "Yahoo Finance / pipeline interno",
      "tempo-real",
      assetPanorama?.generated_at,
      assetPanorama,
    ),
    worldPanorama: createWidget(
      "world_indices",
      "Indices globais",
      "Yahoo Finance",
      "tempo-real",
      worldPanorama?.generated_at,
      worldPanorama,
    ),
    fxData: createWidget("fx_top_movers", "Principais moedas", "Yahoo Finance", "tempo-real", fxData?.generated_at, fxData),
    commPanorama: createWidget(
      "commodities",
      "Commodities",
      "Yahoo Finance",
      "tempo-real",
      commPanorama?.generated_at,
      commPanorama,
    ),
    sectorGlobal: createWidget(
      "global_sectors",
      "Setores globais",
      "Yahoo Finance",
      "diario",
      sectorGlobal?.generated_at,
      sectorGlobal,
    ),
    sectorBr: createWidget("br_sectors", "Setores Brasil", "Yahoo Finance / B3", "diario", sectorBr?.generated_at, sectorBr),
    tablePrefixado: createWidget(
      "curve_prefixado",
      "Curva prefixado",
      "Tesouro / BCB",
      "diario",
      tablePrefixado?.generated_at,
      tablePrefixado,
    ),
    tableIpca: createWidget("curve_ipca", "Curva IPCA+", "Tesouro", "diario", tableIpca?.generated_at, tableIpca),
    tableSelic: createWidget("selic_implicita", "Selic implicita", "B3 PRE", "diario", tableSelic?.generated_at, tableSelic),
    tableTreasury: createWidget("treasury_us", "Curva Treasury EUA", "FRED", "diario", tableTreasury?.generated_at, tableTreasury),
  };
}

export function painelBlobConfigured(): boolean {
  return Boolean(painelBlobBase());
}
