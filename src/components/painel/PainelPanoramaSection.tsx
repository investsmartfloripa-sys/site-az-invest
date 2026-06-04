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
 * cruzam a fronteira RSC). Mercados e Setores lado a lado em telas
 * largas, cada um com tabs + seletores AzSegmented.
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
    <section className="grid items-start gap-5 xl:grid-cols-2">
      <LazyMount minHeight={520}>
        <MarketsPanel
          assetPanorama={assetPanorama}
          worldPanorama={worldPanorama}
          fxData={fxData}
          commPanorama={commPanorama}
        />
      </LazyMount>
      <LazyMount minHeight={520}>
        <SectorsPanel sectorBr={sectorBr} sectorGlobal={sectorGlobal} />
      </LazyMount>
    </section>
  );
}
