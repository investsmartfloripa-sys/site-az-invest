"use client";

import { DynamicFxMoversBar, type FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import { DynamicReturnsBar, type ByPeriodBlock, type Row } from "@/components/painel/DynamicReturnsBar";
import { DynamicSectorBr, type SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import { DynamicSectorGlobal, type SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";
import { LazyMount } from "@/components/painel/panorama/LazyMount";

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
 * Grid de mercados do Panorama (client wrapper): os charts recebem
 * funcoes getValue/filterRow, que nao podem cruzar a fronteira RSC —
 * por isso este componente e "use client" e monta tudo client-side,
 * com LazyMount para nao pesar o primeiro paint.
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#132960] md:text-2xl">Mercados</h2>
        <p className="text-xs text-zinc-400">yfinance · pipeline AZ a cada 15 min</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <LazyMount minHeight={460}>
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
        </LazyMount>
        <LazyMount minHeight={460}>
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
        </LazyMount>
        <LazyMount minHeight={460}>
          <DynamicFxMoversBar title="Principais moedas (var. %)" data={fxData} updatedAt={fxData?.generated_at} />
        </LazyMount>
        <LazyMount minHeight={460}>
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
        </LazyMount>
        <LazyMount minHeight={460}>
          <DynamicSectorGlobal
            title="Setores globais (top / bottom 10)"
            data={sectorGlobal}
            updatedAt={sectorGlobal?.generated_at}
          />
        </LazyMount>
        <LazyMount minHeight={460}>
          <DynamicSectorBr title="Setores Brasil (top / bottom)" data={sectorBr} updatedAt={sectorBr?.generated_at} />
        </LazyMount>
      </div>
    </section>
  );
}
