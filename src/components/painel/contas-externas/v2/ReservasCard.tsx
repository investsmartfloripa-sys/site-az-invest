"use client";

import { useMemo, useState } from "react";

import type { ContasExternasData } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzSeriesPoint, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { fmtUsBi, mesIso, num } from "./shared";

/**
 * Bloco 06 — "o colchão". Dois painéis empilhados (nunca eixo duplo):
 * (a) MESES DE IMPORTAÇÃO que as reservas pagam, contra a régua de 3 meses —
 *     a regra de bolso do FMI é 3 meses de importação (bens e serviços), não 6;
 *     o Brasil opera muito acima e a régua é contexto, não alarme;
 * (b) nível das reservas em US$ bi (conceito liquidez), painel próprio.
 */

type BlocoC = ContasExternasData["bloco_c"];

/** Fallback: mensaliza a série diária (última observação de cada mês). */
function mensalizaDiaria(diaria: BlocoC["reservas_diaria"]): AzSeriesPoint[] {
  const porMes = new Map<string, number>();
  for (const p of diaria) {
    if (typeof p.reservas_us_bi === "number" && Number.isFinite(p.reservas_us_bi)) {
      porMes.set(p.data.slice(0, 7), p.reservas_us_bi); // série ordenada: sobrevive a última do mês
    }
  }
  return [...porMes.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([mes, v]) => [mesIso(mes), v]);
}

export function ReservasCard({ blocoC, geradoEm }: { blocoC: BlocoC; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const mesesSerie = blocoC.meses_importacao_serie ?? [];

  const { mesesMain, mesesBench, usaBensServicos } = useMemo(() => {
    const bensServicos: AzSeriesPoint[] = [];
    const bens: AzSeriesPoint[] = [];
    for (const p of mesesSerie) {
      const bs = num(p, "meses_bens_servicos");
      const b = num(p, "meses_bens");
      if (bs != null) bensServicos.push([mesIso(p.mes), bs]);
      if (b != null) bens.push([mesIso(p.mes), b]);
    }
    if (bensServicos.length > 0) {
      const bench: AzTimeSeries[] =
        bens.length > 0 ? [{ id: "meses_bens", label: "Só bens", color: AZ_BRAND.navy, data: bens }] : [];
      return {
        mesesMain: { id: "meses_bs", label: "Bens e serviços", color: AZ_BRAND.azure, data: bensServicos } as AzTimeSeries,
        mesesBench: bench,
        usaBensServicos: true,
      };
    }
    if (bens.length > 0) {
      return {
        mesesMain: { id: "meses_bens", label: "Meses de importação (bens)", color: AZ_BRAND.azure, data: bens } as AzTimeSeries,
        mesesBench: [] as AzTimeSeries[],
        usaBensServicos: false,
      };
    }
    return { mesesMain: null, mesesBench: [] as AzTimeSeries[], usaBensServicos: false };
  }, [mesesSerie]);

  const reservasPoints = useMemo<AzSeriesPoint[]>(() => {
    const mensal = blocoC.reservas_mensal ?? [];
    if (mensal.length > 0) {
      const out: AzSeriesPoint[] = [];
      for (const p of mensal) {
        const v = num(p, "reservas_us_bi");
        if (v != null) out.push([mesIso(p.mes), v]);
      }
      if (out.length > 0) return out;
    }
    return mensalizaDiaria(blocoC.reservas_diaria);
  }, [blocoC.reservas_mensal, blocoC.reservas_diaria]);

  const ultMeses = mesesMain && mesesMain.data.length > 0 ? mesesMain.data[mesesMain.data.length - 1][1] : null;
  const ultReservas = reservasPoints.length > 0 ? reservasPoints[reservasPoints.length - 1] : null;

  const titulo = useMemo(() => {
    if (ultMeses != null)
      return `As reservas pagam ${fmtNum(ultMeses, 0)} meses de importação — ${fmtNum(ultMeses / 3, 1)}× a regra de bolso do FMI`;
    if (ultReservas) return `As reservas internacionais somam ${fmtUsBi(ultReservas[1], 0)}`;
    return "Reservas internacionais — o colchão externo";
  }, [ultMeses, ultReservas]);

  const minIso = useMemo(() => {
    const candidatos = [mesesMain?.data[0]?.[0], reservasPoints[0]?.[0]].filter((d): d is string => !!d);
    return candidatos.length > 0 ? candidatos.reduce((a, b) => (a < b ? a : b)) : "";
  }, [mesesMain, reservasPoints]);
  const maxIso = useMemo(() => {
    const fimMeses = mesesMain && mesesMain.data.length > 0 ? mesesMain.data[mesesMain.data.length - 1][0] : null;
    const candidatos = [fimMeses, reservasPoints[reservasPoints.length - 1]?.[0]].filter((d): d is string => !!d);
    return candidatos.length > 0 ? candidatos.reduce((a, b) => (a > b ? a : b)) : "";
  }, [mesesMain, reservasPoints]);

  return (
    <ChartCard
      title={titulo}
      subtitle="Painel de cima: quantos meses de importação as reservas cobrem, contra a régua de 3 meses do FMI. Painel de baixo: o nível das reservas em US$ bilhões (conceito liquidez)."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`Reservas (SGS 13982, conceito liquidez) ÷ média mensal das importações ${
        usaBensServicos ? "de bens e serviços" : "de bens"
      } dos últimos 12m. A regra de bolso do FMI é de 3 MESES de importação — o Brasil opera muito acima; a régua é contexto, não alarme. Métricas mais ricas (ARA do FMI; Guidotti–Greenspan: reservas ≥ dívida externa de curto prazo) exigem séries ainda não integradas — evolução registrada na ficha técnica.`}
      stampGiro={geradoEm}
      stampDado={ultReservas ? ultReservas[0] : null}
    >
      <div className="flex flex-col gap-2">
        {mesesMain ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Meses de importação cobertos</p>
            <AzTimeSeriesChart
              series={[mesesMain]}
              benchmarks={mesesBench}
              unit="none"
              period={period}
              height={210}
              refLines={[{ y: 3, label: "regra de bolso FMI: 3 meses", color: AZ_BRAND.rust }]}
              yAxisLabel="meses"
            />
          </>
        ) : (
          <p className="flex h-24 items-center justify-center text-xs text-zinc-400">
            O pipeline ainda não publicou a série de meses de importação (meses_importacao_serie).
          </p>
        )}

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nível das reservas</p>
        <AzTimeSeriesChart
          series={[{ id: "reservas", label: "Reservas (US$ bi)", color: AZ_BRAND.azure, data: reservasPoints }]}
          unit="none"
          period={period}
          height={210}
          showLegend={false}
          yAxisLabel="US$ bi"
        />
      </div>
    </ChartCard>
  );
}
