"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { ChartCard } from "@/components/painel/core";
import type { FiscalDpfRmdData } from "@/lib/painel-fiscal";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { CockpitChip, toPoints, ultimoPonto } from "./shared";

/**
 * Perfil de rolagem da DPF (RMD/Tesouro) — dois mini-painéis lado a lado no
 * padrão do PoupancaCard da aba de risco: à esquerda o prazo médio do estoque
 * (anos), à direita o % vincendo em 12 meses (a pressão de rolagem). O custo
 * médio 12m vira chip ao lado do título; leitura no footer (?).
 */

export function DpfRmdCard({ dpf, geradoEm }: { dpf: FiscalDpfRmdData; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { prazo, vincendo, minIso, maxIso } = useMemo(() => {
    const p = toPoints(dpf.prazo_medio_dpf_anos);
    const v = toPoints(dpf.vincendo_12m_pct);
    return {
      prazo: [{ id: "prazo_dpf", label: "Prazo médio da DPF (anos)", color: AZ_BRAND.navy, data: p }] as AzTimeSeries[],
      vincendo: [{ id: "vincendo_12m", label: "% da DPF vincendo em 12m", color: AZ_BRAND.navy, data: v }] as AzTimeSeries[],
      minIso: p[0]?.[0] ?? v[0]?.[0] ?? "",
      maxIso: p[p.length - 1]?.[0] ?? v[v.length - 1]?.[0] ?? "",
    };
  }, [dpf.prazo_medio_dpf_anos, dpf.vincendo_12m_pct]);

  const custo = useMemo(() => ultimoPonto(dpf.custo_medio_12m_aa_pct), [dpf.custo_medio_12m_aa_pct]);

  if (prazo[0].data.length === 0 && vincendo[0].data.length === 0) {
    return (
      <ChartCard title="DPF — prazo médio e rolagem" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou o RMD (build_dpf_rmd.py).
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="DPF — prazo médio e rolagem"
      subtitle="Dívida Pública Federal (RMD/Tesouro): prazo médio do estoque (anos) e parcela vincendo em 12 meses (%)"
      footer={
        <span>
          {dpf._fonte} {dpf._nota} Leitura: prazo médio curto + % vincendo alto = mais dívida voltando ao mercado a
          cada ano, rolada ao juro corrente — o custo médio do chip é a taxa média das emissões/estoque em 12 meses.
        </span>
      }
      stampGiro={geradoEm}
      stampDado={maxIso || null}
      toolbar={
        <>
          {custo != null ? (
            <CockpitChip cor={AZ_BRAND.azure}>custo médio {fmtNum(custo.valor, 1)}% a.a.</CockpitChip>
          ) : null}
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["ytd", "1y", "5y", "max"]}
          />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Prazo médio do estoque (anos)
          </p>
          <AzTimeSeriesChart
            series={prazo}
            unit="none"
            period={period}
            height={200}
            showLegend={false}
            yAxisLabel="anos"
            variant="hero"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Vincendo em 12 meses (% da DPF)
          </p>
          <AzTimeSeriesChart
            series={vincendo}
            unit="%"
            period={period}
            height={200}
            showLegend={false}
            yAxisLabel="%"
            variant="hero"
          />
        </div>
      </div>
    </ChartCard>
  );
}
