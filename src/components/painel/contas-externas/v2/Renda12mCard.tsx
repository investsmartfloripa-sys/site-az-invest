"use client";

import { useMemo, useState } from "react";

import type { Bp12mPonto, Renda12mPonto } from "@/lib/painel-contas-externas";
import { ChartCard } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_SERIES } from "@/lib/az-chart-theme";
import { Stacked12mChart, type StackSerie } from "./Stacked12mChart";
import { filtraPeriodoMes, fmtUsBi, mesIso, num, ultimo } from "./shared";

/**
 * Bloco 04 — "por que o déficit não vai embora". A renda primária é o déficit
 * ESTRUTURAL do BP brasileiro: lucros e dividendos do estoque de IDP + juros
 * da dívida saem todo ano, independentemente do câmbio. O saldo de bens 12m
 * entra como linha tracejada de comparação — o tamanho da conta que o
 * comércio precisa pagar.
 */

const STACKS: StackSerie[] = [
  { key: "lucros_dividendos_idp", label: "Lucros e dividendos (IDP)", color: AZ_SERIES[0] },
  { key: "lucros_reinvestidos", label: "Lucros reinvestidos", color: AZ_SERIES[4] },
  { key: "juros_e_demais", label: "Juros e demais rendas", color: AZ_SERIES[2] },
  // Ciano de propósito: o verde-mar (AZ_SERIES[3]) é da linha-memo do saldo de bens.
  { key: "salarios", label: "Salários", color: AZ_SERIES[6] },
];

type RendaRow = Renda12mPonto & { memo_bens: number | null };

export function Renda12mCard({
  serie12m,
  decomposicao12m,
  nota,
  geradoEm,
}: {
  serie12m: Renda12mPonto[];
  /** Fonte do memo "saldo de bens 12m" (mesma janela, mesmo eixo). */
  decomposicao12m: Bp12mPonto[];
  nota?: string;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const comMemo = useMemo<RendaRow[]>(() => {
    const bensByMes = new Map(decomposicao12m.map((p) => [p.mes, p.bens]));
    return serie12m.map((p) => ({ ...p, memo_bens: bensByMes.get(p.mes) ?? null }));
  }, [serie12m, decomposicao12m]);

  const rows = useMemo(() => filtraPeriodoMes(comMemo, period), [comMemo, period]);
  const minIso = serie12m.length > 0 ? mesIso(serie12m[0].mes) : "";
  const maxIso = serie12m.length > 0 ? mesIso(serie12m[serie12m.length - 1].mes) : "";

  const titulo = useMemo(() => {
    const u = comMemo.length > 0 ? comMemo[comMemo.length - 1] : null;
    const total = num(u, "total");
    if (u == null || total == null) return "Renda primária — acumulado 12 meses";
    const bens = num(u, "memo_bens");
    const drenagem = Math.abs(Math.min(total, 0));
    if (total >= 0) return `A renda primária está superavitária em ${fmtUsBi(total)} em 12 meses — exceção histórica`;
    if (bens == null) return `Lucros e juros drenam ${fmtUsBi(drenagem)} em 12 meses`;
    return `Lucros e juros drenam ${fmtUsBi(drenagem)} em 12 meses — ${
      drenagem <= bens ? "menos" : "mais"
    } que o superávit de bens (${fmtUsBi(bens)})`;
  }, [comMemo]);

  const ultTotal = ultimo(serie12m, "total");

  return (
    <ChartCard
      title={titulo}
      subtitle="Saldo da renda primária por componente, acumulado em 12 meses, US$ bilhões. A linha tracejada verde é o saldo de bens 12m — a conta que o comércio precisa cobrir."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`Renda primária 12m (total SGS 22800): lucros e dividendos de IDP 22812, lucros reinvestidos 22815, salários 22803; "juros e demais" é o residual auditado da renda de investimento (22806) — majoritariamente juros de dívida e de portfólio. Lucros reinvestidos têm contrapartida no IDP (não saem do país, mas são renda devida ao estrangeiro).${nota ? ` ${nota}` : ""}`}
      stampGiro={geradoEm}
      stampDado={ultTotal ? mesIso(ultTotal.row.mes) : null}
    >
      <Stacked12mChart
        rows={rows}
        stacks={STACKS}
        totalKey="total"
        totalLabel="Renda primária (12m)"
        linhasExtras={[{ key: "memo_bens", label: "Saldo de bens (12m, memo)", color: AZ_SERIES[3] }]}
      />
    </ChartCard>
  );
}
