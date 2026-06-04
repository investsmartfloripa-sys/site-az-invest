"use client";

import type { FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import type { ByPeriodBlock } from "@/components/painel/DynamicReturnsBar";
import type { SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import type { SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";
import { LazyMount } from "@/components/painel/panorama/LazyMount";
import { MarketsPanel } from "@/components/painel/panorama/MarketsPanel";
import { SectorsPanel } from "@/components/painel/panorama/SectorsPanel";

type PanoramaByPeriod = { generated_at?: string; by_period?: ByPeriodBlock };

type Props = {
  assetPanorama: PanoramaByPeriod | null;
  worldPanorama: PanoramaByPeriod | null;
  fxData: FxMoversPayload | null;
  commPanorama: PanoramaByPeriod | null;
  sectorGlobal: SectorGlobalPayload | null;
  sectorBr: SectorBrPayload | null;
};

/**
 * Secao de mercados do Panorama (client wrapper — funcoes/estado nao
 * cruzam a fronteira RSC). Dois cards unificados com segmented control:
 * retornos (Ativos | Indices | Moedas | Commodities) e setores (BR | Global).
 */
export function PainelPanoramaSection({
  assetPanorama,
  worldPanorama,
  fxData,
  commPanorama,
  sectorGlobal,
  sectorBr,
}: Props) {
  return (
    <section className="space-y-5">
      <LazyMount minHeight={520}>
        <MarketsPanel
          assetPanorama={assetPanorama}
          worldPanorama={worldPanorama}
          fxData={fxData}
          commPanorama={commPanorama}
        />
      </LazyMount>
      <LazyMount minHeight={420}>
        <SectorsPanel sectorBr={sectorBr} sectorGlobal={sectorGlobal} />
      </LazyMount>
    </section>
  );
}
