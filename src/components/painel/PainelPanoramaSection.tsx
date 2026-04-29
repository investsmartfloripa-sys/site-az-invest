"use client";

import { DynamicFxMoversBar, type FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import { DynamicReturnsBar, type ByPeriodBlock, type Row } from "@/components/painel/DynamicReturnsBar";
import { DynamicSectorBr, type SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import { DynamicSectorGlobal, type SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";

type PanoramaByPeriod = { generated_at?: string; by_period?: ByPeriodBlock };

type Props = {
  assetPanorama: PanoramaByPeriod | null;
  worldPanorama: PanoramaByPeriod | null;
  fxData: FxMoversPayload | null;
  commPanorama: PanoramaByPeriod | null;
  sectorGlobal: SectorGlobalPayload | null;
  sectorBr: SectorBrPayload | null;
};

export function PainelPanoramaSection({
  assetPanorama,
  worldPanorama,
  fxData,
  commPanorama,
  sectorGlobal,
  sectorBr,
}: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-[#027DFC]">Panorama</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 w-full">
          <DynamicReturnsBar
            title="Retornos dos ativos (%)"
            byPeriod={(assetPanorama?.by_period ?? {}) as ByPeriodBlock}
            updatedAt={assetPanorama?.generated_at}
            currencyToggle
            filterRow={(r: Row) => String(r.ticker ?? "") !== "BRL=X"}
            getValue={(row, opts) => {
              const cur = opts?.currency ?? "brl";
              const v = cur === "brl" ? row.return_brl_pct : row.return_usd_pct;
              if (v == null) return null;
              return Number(v);
            }}
          />
        </div>
        <div className="min-w-0 w-full">
          <DynamicReturnsBar
            title="Retornos indices globais (%)"
            byPeriod={(worldPanorama?.by_period ?? {}) as ByPeriodBlock}
            updatedAt={worldPanorama?.generated_at}
            getValue={(row) => {
              const v = row.return_pct;
              if (v == null) return null;
              return Number(v);
            }}
          />
        </div>
        <div className="min-w-0 w-full">
          <DynamicFxMoversBar title="Principais moedas (var. %)" data={fxData} updatedAt={fxData?.generated_at} />
        </div>
        <div className="min-w-0 w-full">
          <DynamicReturnsBar
            title="Indice de commodities (%)"
            byPeriod={(commPanorama?.by_period ?? {}) as ByPeriodBlock}
            updatedAt={commPanorama?.generated_at}
            currencyToggle
            getValue={(row, opts) => {
              const cur = opts?.currency ?? "brl";
              const v = cur === "brl" ? row.return_pct_brl : row.return_pct_usd;
              if (v == null) return null;
              return Number(v);
            }}
          />
        </div>
        <div className="min-w-0 w-full">
          <DynamicSectorGlobal
            title="Setores globais (top / bottom 10)"
            data={sectorGlobal}
            updatedAt={sectorGlobal?.generated_at}
          />
        </div>
        <div className="min-w-0 w-full">
          <DynamicSectorBr title="Setores Brasil (top / bottom)" data={sectorBr} updatedAt={sectorBr?.generated_at} />
        </div>
      </div>
    </section>
  );
}
