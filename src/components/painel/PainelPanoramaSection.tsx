"use client";

import { DynamicFxMoversBar, type FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import { DynamicReturnsBar, type ByPeriodBlock, type Row } from "@/components/painel/DynamicReturnsBar";
import { DynamicSectorBr, type SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import { DynamicSectorGlobal, type SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";

type PanoramaByPeriod = { by_period?: ByPeriodBlock };

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
        <DynamicReturnsBar
          title="Retornos dos ativos (%)"
          byPeriod={(assetPanorama?.by_period ?? {}) as ByPeriodBlock}
          currencyToggle
          filterRow={(r: Row) => String(r.ticker ?? "") !== "BRL=X"}
          getValue={(row, opts) => {
            const cur = opts?.currency ?? "brl";
            const v = cur === "brl" ? row.return_brl_pct : row.return_usd_pct;
            if (v == null) return null;
            return Number(v);
          }}
        />
        <DynamicReturnsBar
          title="Retornos indices globais (%)"
          byPeriod={(worldPanorama?.by_period ?? {}) as ByPeriodBlock}
          getValue={(row) => {
            const v = row.return_pct;
            if (v == null) return null;
            return Number(v);
          }}
        />
        <DynamicFxMoversBar title="Principais moedas (var. %)" data={fxData} />
        <DynamicReturnsBar
          title="Indice de commodities (%)"
          byPeriod={(commPanorama?.by_period ?? {}) as ByPeriodBlock}
          currencyToggle
          getValue={(row, opts) => {
            const cur = opts?.currency ?? "brl";
            const v = cur === "brl" ? row.return_pct_brl : row.return_pct_usd;
            if (v == null) return null;
            return Number(v);
          }}
        />
        <DynamicSectorGlobal title="Setores globais (top / bottom 10)" data={sectorGlobal} />
        <DynamicSectorBr title="Setores Brasil (top / bottom)" data={sectorBr} />
      </div>
    </section>
  );
}
