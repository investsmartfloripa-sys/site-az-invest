"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasEndividamentoData } from "@/lib/painel-familias";
import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { CICLOS_APERTO_SELIC, clipFaixas, codaceAreas, mergeMensal, num } from "./shared";

/**
 * "Quanto do salário vai ao banco?" — comprometimento mensal de renda com o
 * serviço da dívida, DECOMPOSTO em juros + amortização (área empilhada: o
 * topo é o total por construção). Os ciclos de aperto da Selic sombreados
 * mostram o canal: quando o juro sobe, a fatia de JUROS incha mesmo sem
 * dívida nova. Régua: média histórica tracejada.
 */

type Row = { mes: string; juros: number; amortizacao: number; total: number };

export function ComprometimentoCard({
  endividamento,
  codaceMensal,
  geradoEm,
}: {
  endividamento: FamiliasEndividamentoData;
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const todos = useMemo<Row[]>(() => {
    const merged = mergeMensal(endividamento.bloco_comprometimento.series_pontos, [
      { src: "servico_divida", alias: "total" },
      { src: "juros", alias: "juros" },
      { src: "amortizacao", alias: "amortizacao" },
    ]);
    const out: Row[] = [];
    for (const r of merged) {
      const total = num(r, "total");
      const juros = num(r, "juros");
      const amortizacao = num(r, "amortizacao");
      if (total == null || juros == null || amortizacao == null) continue;
      out.push({ mes: r.mes, juros, amortizacao, total });
    }
    return out;
  }, [endividamento.bloco_comprometimento.series_pontos]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  // Média HISTÓRICA do total (série completa, não só a janela) — régua estável.
  const mediaTotal = useMemo(() => {
    if (todos.length === 0) return null;
    let soma = 0;
    for (const r of todos) soma += r.total;
    return +(soma / todos.length).toFixed(2);
  }, [todos]);

  const keysVisiveis = useMemo(() => rows.map((r) => r.mes), [rows]);
  const faixasCodace = useMemo(() => clipFaixas(codaceAreas(codaceMensal), keysVisiveis), [codaceMensal, keysVisiveis]);
  const faixasAperto = useMemo(() => clipFaixas(CICLOS_APERTO_SELIC, keysVisiveis), [keysVisiveis]);

  const ult = todos[todos.length - 1];
  const titulo = ult
    ? `${fmtPct(ult.total, 1)} da renda do mês vai ao serviço da dívida — ${
        mediaTotal == null
          ? "juros + amortização"
          : ult.total > mediaTotal + 0.3
            ? `acima da média histórica (${fmtPct(mediaTotal, 1)})`
            : ult.total < mediaTotal - 0.3
              ? `abaixo da média histórica (${fmtPct(mediaTotal, 1)})`
              : `em linha com a média histórica (${fmtPct(mediaTotal, 1)})`
      }`
    : "Comprometimento mensal de renda com dívida";

  return (
    <ChartCard
      title={titulo}
      subtitle="Parcela da renda mensal das famílias destinada a pagar dívida, decomposta em JUROS (o custo) e AMORTIZAÇÃO (o principal). O topo da pilha é o comprometimento total por construção."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="BCB SGS 29034 (serviço da dívida, com ajuste sazonal), 29033 (juros) e 29036 (amortização). Faixas LARANJAS: ciclos de aperto da Selic (2013–16 e 2021–24) — marcação EDITORIAL declarada, não régua oficial; faixas cinzas: recessões CODACE/FGV. Linha tracejada: média de toda a série."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
            {faixasCodace.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}
            {faixasAperto.map((f, i) => (
              <ReferenceArea
                key={`aperto-${i}`}
                x1={f.x1}
                x2={f.x2}
                fill={f.color}
                fillOpacity={f.opacity}
                stroke="none"
                label={{ value: f.label, position: "insideTop", fontSize: 9, fill: "#C2410C" }}
              />
            ))}
            {mediaTotal != null ? (
              <ReferenceLine
                y={mediaTotal}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{
                  value: `média histórica ${fmtPct(mediaTotal, 1)}`,
                  position: "insideBottomRight",
                  fontSize: 9,
                  fill: AZ_BRAND.navy,
                }}
              />
            ) : null}
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="juros"
              name="Juros"
              stackId="comp"
              stroke={AZ_SERIES[2]}
              strokeWidth={1.4}
              fill={AZ_SERIES[2]}
              fillOpacity={0.3}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="amortizacao"
              name="Amortização"
              stackId="comp"
              stroke={AZ_SERIES[6]}
              strokeWidth={1.4}
              fill={AZ_SERIES[6]}
              fillOpacity={0.3}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total (serviço da dívida)"
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
    </ChartCard>
  );
}
