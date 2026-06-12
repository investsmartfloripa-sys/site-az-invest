"use client";

import { useMemo, useState } from "react";

import type { Servicos12mPonto } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_SERIES } from "@/lib/az-chart-theme";
import { Stacked12mChart, type StackSerie } from "./Stacked12mChart";
import { filtraPeriodoMes, fmtUsBi, mesIso, num, ultimo } from "./shared";

/**
 * Bloco 03 — "onde mora o rombo de serviços". Saldos 12m por conta de
 * serviços empilhados + linha do total. O Brasil é deficitário estrutural em
 * serviços; o gráfico mostra QUAL conta lidera o rombo (verificado no título).
 */

const RESIDUO_COLOR = "#94A3B8";

const STACKS: StackSerie[] = [
  { key: "transportes", label: "Transportes", color: AZ_SERIES[0] },
  { key: "viagens", label: "Viagens", color: AZ_SERIES[2] },
  { key: "telecom_informatica", label: "Telecom e informática", color: AZ_SERIES[4] },
  { key: "propriedade_intelectual", label: "Propriedade intelectual", color: AZ_SERIES[5] },
  { key: "demais", label: "Demais serviços (residual)", color: RESIDUO_COLOR },
];

const LABEL_CURTO: Record<string, string> = {
  transportes: "Transportes",
  viagens: "Viagens",
  telecom_informatica: "Telecom e informática",
  propriedade_intelectual: "Propriedade intelectual",
  demais: "Demais serviços",
};

export function Servicos12mCard({
  serie12m,
  nota,
  geradoEm,
}: {
  serie12m: Servicos12mPonto[];
  nota?: string;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const rows = useMemo(() => filtraPeriodoMes(serie12m, period), [serie12m, period]);
  const minIso = serie12m.length > 0 ? mesIso(serie12m[0].mes) : "";
  const maxIso = serie12m.length > 0 ? mesIso(serie12m[serie12m.length - 1].mes) : "";

  const titulo = useMemo(() => {
    const u = serie12m.length > 0 ? serie12m[serie12m.length - 1] : null;
    const total = num(u, "total");
    if (u == null || total == null) return "Saldo de serviços — acumulado 12 meses";
    if (total >= 0) return `Serviços estão superavitários em ${fmtUsBi(total)} em 12 meses — exceção histórica`;
    // Maior déficit entre as contas (residual incluído, mas perde o título se empatar).
    let pior: { key: string; v: number } | null = null;
    for (const k of ["transportes", "viagens", "telecom_informatica", "propriedade_intelectual", "demais"]) {
      const v = num(u, k);
      if (v != null && v < 0 && (pior == null || v < pior.v)) pior = { key: k, v };
    }
    if (!pior) return `O déficit de serviços soma ${fmtUsBi(Math.abs(total))} em 12 meses`;
    return `${LABEL_CURTO[pior.key]} lidera o déficit de serviços de ${fmtUsBi(Math.abs(total))} em 12 meses (${fmtUsBi(pior.v)})`;
  }, [serie12m]);

  const ultTotal = ultimo(serie12m, "total");

  return (
    <ChartCard
      title={titulo}
      subtitle="Saldo por conta de serviços, acumulado em 12 meses, US$ bilhões — a linha navy é o saldo total de serviços."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`Saldos 12m por conta: transportes SGS 22728, viagens 22740, telecom/computação/informação 22776, propriedade intelectual 22779; "demais" é o residual auditado contra o total de serviços (22719) — inclui seguros, financeiros, aluguel de equipamentos e outros.${nota ? ` ${nota}` : ""}`}
      stampGiro={geradoEm}
      stampDado={ultTotal ? mesIso(ultTotal.row.mes) : null}
    >
      <Stacked12mChart rows={rows} stacks={STACKS} totalKey="total" totalLabel="Saldo de serviços (12m)" />
    </ChartCard>
  );
}
