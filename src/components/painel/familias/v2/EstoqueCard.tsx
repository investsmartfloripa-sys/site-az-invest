"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ComposicaoPctPonto, FamiliasEndividamentoData } from "@/lib/painel-familias";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_CHART, AZ_SERIES_EXTRA, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct } from "@/lib/format-br";
import { chaveMaisProxima, isoData, num } from "./shared";

/**
 * "Onde mora a dívida" — composição do estoque de crédito PF (% do saldo
 * total) em área empilhada 100%, série longa. A história estrutural: o
 * habitacional engordando desde o MCMV, o consignado como segunda perna e o
 * cartão crescendo na margem. Marcos editoriais discretos nas viradas
 * regulatórias.
 */

const FATIAS = [
  { key: "habitacional_pct", label: "Habitacional", color: "#027DFC" },
  { key: "consignado_pct", label: "Consignado", color: "#132960" },
  { key: "cartao_pct", label: "Cartão", color: "#FF5713" },
  { key: "veiculos_pct", label: "Veículos", color: "#A16207" },
  { key: "credito_pessoal_pct", label: "Pessoal não consignado", color: "#7C3AED" },
  { key: "cheque_especial_pct", label: "Cheque especial", color: AZ_SERIES_EXTRA },
  { key: "rural_pct", label: "Crédito rural", color: "#1E8A5C" },
  { key: "outras_pct", label: "Outras (residual)", color: "#64748B" },
] as const;

/** Marcos regulatórios — anotações EDITORIAIS discretas (declaradas no footer). */
const MARCOS = [
  { alvo: "2009-04-01", label: "MCMV" },
  { alvo: "2024-01-01", label: "teto do rotativo" },
  { alvo: "2025-03-01", label: "consignado CLT" },
] as const;

type Row = Record<string, number | string> & { mes: string };

export function EstoqueCard({
  endividamento,
  geradoEm,
}: {
  endividamento: FamiliasEndividamentoData;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const todos = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of endividamento.bloco_estoque.composicao_pct ?? []) {
      const row: Row = { mes: isoData(p.mes) };
      for (const f of FATIAS) {
        const v = num(p as ComposicaoPctPonto & Record<string, unknown>, f.key);
        if (v != null) row[f.key] = v;
      }
      out.push(row);
    }
    return out.sort((a, b) => (a.mes < b.mes ? -1 : 1));
  }, [endividamento.bloco_estoque.composicao_pct]);

  const minIso = todos.length > 0 ? todos[0].mes : "";
  const maxIso = todos.length > 0 ? todos[todos.length - 1].mes : "";

  const rows = useMemo(() => {
    if (todos.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todos.filter((r) => r.mes >= from && r.mes <= to);
  }, [todos, period, minIso, maxIso]);

  const keysVisiveis = useMemo(() => rows.map((r) => r.mes), [rows]);
  const marcosVisiveis = useMemo(() => {
    const out: { label: string; x: string }[] = [];
    for (const m of MARCOS) {
      const x = chaveMaisProxima(keysVisiveis, m.alvo);
      if (x != null) out.push({ label: m.label, x });
    }
    return out;
  }, [keysVisiveis]);

  // Maior fatia do mês mais recente — título afirmativo verificado.
  const ult = todos[todos.length - 1];
  const maior = useMemo(() => {
    if (!ult) return null;
    let melhor: { label: string; v: number } | null = null;
    for (const f of FATIAS) {
      if (f.key === "outras_pct") continue;
      const v = ult[f.key];
      if (typeof v === "number" && (melhor == null || v > melhor.v)) melhor = { label: f.label, v };
    }
    return melhor;
  }, [ult]);

  const titulo = maior
    ? `Onde mora a dívida: ${fmtNum(maior.v, 0)}% do estoque é ${maior.label.toLowerCase()}`
    : "Composição do estoque de crédito PF";

  return (
    <ChartCard
      title={titulo}
      subtitle="Participação de cada modalidade no saldo total de crédito à pessoa física (% — a pilha soma 100). É a foto ESTRUTURAL da dívida: muda devagar, e cada virada tem um marco regulatório atrás."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["5y", "max"]} />}
      footer="BCB SGS — saldos das carteiras PF (20541 total; modalidades 20573–20612); 'Outras' é o residual (~6%, modalidades menores). Marcos verticais são anotações EDITORIAIS: lançamento do Minha Casa Minha Vida (abr/2009), teto do rotativo (jan/2024, Lei 14.690/2023) e consignado CLT (mar/2025) — contexto, não causalidade."
      stampGiro={geradoEm}
      stampDado={maxIso || null}
    >
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={36} />
            <YAxis {...azYAxisProps()} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />
            <Tooltip
              content={<AzTooltip labelFmt={(l) => fmtMesCurto(String(l))} valueFmt={(v) => fmtPct(v, 1)} />}
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {FATIAS.map((f) => (
              <Area
                key={f.key}
                type="monotone"
                dataKey={f.key}
                name={f.label}
                stackId="estoque"
                stroke={f.color}
                strokeWidth={0.8}
                fill={f.color}
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            ))}
            {marcosVisiveis.map((m) => (
              <ReferenceLine
                key={m.label}
                x={m.x}
                stroke={AZ_CHART.zero}
                strokeOpacity={0.45}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: m.label, position: "insideTop", fontSize: 9, fill: "#334155" }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
