"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasRendaData } from "@/lib/painel-familias";
import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtBRL, fmtMesCurto, fmtPct, fmtSignedPct } from "@/lib/format-br";
import { clipFaixas, codaceAreas, fmtTrimMovel, mesIso, num } from "./shared";

/**
 * ÂNCORA do Painel Famílias v2 — "quanto o trabalho rende, em termos reais?".
 *
 * Painel de cima: NÍVEL do rendimento médio real (trimestre móvel, PNADC) —
 * só a linha REAL; o nominal vive no tooltip (no mesmo eixo ele só conta a
 * história da inflação). Painel de baixo: variação interanual REAL em barras
 * coloridas por sinal. Recessões CODACE sombreadas; o pico pré-recessão de
 * 2015-16 vira régua horizontal derivada da própria série.
 */

type Row = { mes: string; real: number; nominal: number | null };
type RowVar = { mes: string; varReal: number };

export function RendaRealCard({
  renda,
  codaceMensal,
  geradoEm,
}: {
  renda: FamiliasRendaData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const todos = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of renda.bloco_renda_total.serie ?? []) {
      const real = num(p, "rendimento_medio_real");
      if (real == null) continue;
      out.push({ mes: mesIso(p.trim), real, nominal: num(p, "rendimento_medio_nominal") });
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [renda.bloco_renda_total.serie]);

  const todosVar = useMemo<RowVar[]>(() => {
    const out: RowVar[] = [];
    for (const p of renda.bloco_renda_total.serie ?? []) {
      const v = num(p, "var_pct_aa_real");
      if (v == null) continue;
      out.push({ mes: mesIso(p.trim), varReal: v });
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [renda.bloco_renda_total.serie]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const rowsVar = useMemo(() => {
    if (todosVar.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todosVar.filter((r) => r.mes >= from && r.mes <= to);
  }, [todosVar, period, minIso, maxIso]);

  // Pico pré-recessão de 2015-16, derivado da série (máximo até dez/2015).
  const pico = useMemo(() => {
    let melhor: Row | null = null;
    for (const r of todos) {
      if (r.mes >= "2016-01-01") break;
      if (melhor == null || r.real > melhor.real) melhor = r;
    }
    return melhor;
  }, [todos]);

  const faixas = useMemo(
    () =>
      clipFaixas(
        codaceAreas(codaceMensal),
        rows.map((r) => r.mes),
      ),
    [codaceMensal, rows],
  );

  // Domain Y manual do nível (só a linha REAL conta — o nominal está em eixo oculto).
  const yDomain = useMemo<[number, number]>(() => {
    if (rows.length === 0) return [0, 1];
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      if (r.real < lo) lo = r.real;
      if (r.real > hi) hi = r.real;
    }
    const pad = Math.max((hi - lo) * 0.08, 20);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }, [rows]);

  const ult = todos[todos.length - 1];
  const ultVar = todosVar[todosVar.length - 1];

  const titulo = ult
    ? `Renda real do trabalho: ${fmtBRL(ult.real, 0)} por mês — ${
        ultVar == null
          ? "trimestre móvel mais recente"
          : ultVar.varReal > 0.05
            ? `alta de ${fmtPct(ultVar.varReal, 1)} em um ano`
            : ultVar.varReal < -0.05
              ? `queda de ${fmtPct(Math.abs(ultVar.varReal), 1)} em um ano`
              : "estável em um ano"
      }`
    : "Renda real do trabalho — trimestre móvel";

  return (
    <ChartCard
      title={titulo}
      subtitle={`Rendimento médio real habitual de todos os trabalhos (PNAD Contínua, trimestre móvel${
        ult ? ` ${fmtTrimMovel(ult.mes.slice(0, 7))}` : ""
      }). Painel de baixo: variação real contra o mesmo trimestre móvel do ano anterior. O valor nominal aparece no tooltip — no gráfico ele só contaria a história da inflação.`}
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer={`IBGE/SIDRA 6390 — rendimento já deflacionado pelo PRÓPRIO IBGE (deflatores do IPCA específicos da pesquisa; não re-deflacionamos). Trimestre móvel: cada ponto agrega 3 meses terminados no mês do rótulo. Faixas cinzas: recessões CODACE/FGV. ${
        pico ? `Linha tracejada: pico pré-recessão de 2015-16 (${fmtMesCurto(pico.mes)}), derivado da própria série.` : ""
      }`}
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Nível real (R$ por mês)</p>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={52} domain={yDomain} tickFormatter={(v: number) => fmtBRL(v, 0)} />
            {faixas.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}
            {pico ? (
              <ReferenceLine
                y={pico.real}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: `pico pré-recessão ${fmtMesCurto(pico.mes)}: ${fmtBRL(pico.real, 0)}`,
                  position: "insideTopLeft",
                  fontSize: 9,
                  fill: AZ_BRAND.navy,
                }}
              />
            ) : null}
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => `trim. móvel ${fmtTrimMovel(String(l).slice(0, 7))}`}
                  valueFmt={(v) => fmtBRL(v, 0)}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Line
              type="monotone"
              dataKey="real"
              name="Real (R$ de hoje)"
              stroke={AZ_BRAND.azure}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
            {/* Nominal SÓ no tooltip: eixo Y oculto próprio p/ não distorcer a escala do real. */}
            <YAxis yAxisId="oculto" hide domain={["auto", "auto"]} />
            <Line
              yAxisId="oculto"
              type="monotone"
              dataKey="nominal"
              name="Nominal (R$ correntes)"
              stroke="transparent"
              strokeWidth={0}
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Variação real em 12 meses</p>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rowsVar} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={52} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />
            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => `trim. móvel ${fmtTrimMovel(String(l).slice(0, 7))}`}
                  valueFmt={(v) => fmtSignedPct(v, 1)}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Bar dataKey="varReal" name="Variação real (YoY)" isAnimationActive={false} maxBarSize={14}>
              {rowsVar.map((r) => (
                <Cell key={r.mes} fill={variationFill(r.varReal)} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
