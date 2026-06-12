"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FamiliasEndividamentoData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { mergeMensal, num } from "./shared";

/**
 * "Dívida: patrimônio ou consumo?" — endividamento das famílias (% da renda
 * de 12 meses) DECOMPOSTO em habitacional (derivado: total − ex-habitacional)
 * × não habitacional, em área empilhada. A leitura honesta: dívida de casa
 * própria constrói patrimônio; o que pressiona o orçamento é a fatia de
 * consumo. SEM "faixa de risco": não existe limiar técnico consensual — e na
 * régua internacional (OCDE) o nível brasileiro é BAIXO (ver footer).
 */

type Row = { mes: string; habitacional: number; naoHabitacional: number; total: number };

export function EndividamentoCard({
  endividamento,
  geradoEm,
}: {
  endividamento: FamiliasEndividamentoData;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const todos = useMemo<Row[]>(() => {
    const merged = mergeMensal(endividamento.bloco_endividamento.series_pontos, [
      { src: "total", alias: "total" },
      { src: "sem_habitacional", alias: "semHabit" },
    ]);
    const out: Row[] = [];
    for (const r of merged) {
      const total = num(r, "total");
      const semHabit = num(r, "semHabit");
      if (total == null || semHabit == null) continue;
      out.push({
        mes: r.mes,
        habitacional: +(total - semHabit).toFixed(2),
        naoHabitacional: semHabit,
        total,
      });
    }
    return out;
  }, [endividamento.bloco_endividamento.series_pontos]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const ult = todos[todos.length - 1];
  const shareHabit = ult && ult.total > 0 ? (100 * ult.habitacional) / ult.total : null;

  const titulo = ult
    ? `Famílias devem ${fmtPct(ult.total, 1)} da renda anual aos bancos — ${
        shareHabit != null ? `${fmtNum(shareHabit, 0)}% disso é a casa própria` : "incluindo o financiamento da casa própria"
      }`
    : "Endividamento das famílias (% da renda de 12 meses)";

  return (
    <ChartCard
      title={titulo}
      subtitle="Dívida total das famílias com o sistema financeiro ÷ renda acumulada em 12 meses. A fatia habitacional (derivada por diferença) constrói patrimônio e tem juro/garantia próprios; a não habitacional é a que pressiona o orçamento corrente."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="BCB SGS 29037 (total) e 29038 (ex-habitacional); habitacional = diferença. Sem 'faixa de risco': não há limiar técnico consensual. Na régua da OCDE (dívida ÷ renda DISPONÍVEL), o endividamento das famílias brasileiras é baixo ante economias avançadas (Holanda, Noruega e Austrália superam 180%) — com ressalva de comparabilidade: o numerador do BCB cobre só o SFN e o denominador (massa salarial ampliada) difere da renda disponível das contas nacionais."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="naoHabitacional"
              name="Não habitacional (consumo)"
              stackId="endiv"
              stroke={AZ_BRAND.azure}
              strokeWidth={1.4}
              fill={AZ_BRAND.azure}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="habitacional"
              name="Habitacional (patrimônio)"
              stackId="endiv"
              stroke={AZ_BRAND.navy}
              strokeWidth={1.4}
              fill={AZ_BRAND.navy}
              fillOpacity={0.3}
              isAnimationActive={false}
            />
            {/* Total no tooltip (topo da pilha por construção) — linha invisível. */}
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
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
