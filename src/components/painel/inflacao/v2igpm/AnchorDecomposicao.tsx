"use client";

import { useMemo, useState } from "react";
import {
  Bar,
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

import type { DecomposicaoBlock } from "@/lib/painel-igpm";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { CORES_COMPONENTE, COR_RESIDUO, mesIso, nomeCurto, num } from "./shared";

/**
 * ÂNCORA do Painel IGP-M v2 — "o que move o IGP-M: atacado, varejo ou construção?".
 *
 * Barras EMPILHADAS de contribuição mensal por componente + linha do IGP-M
 * cheio. As contribuições usam PESOS EFETIVOS encadeados calculados no
 * builder (os fixos 60/30/10 deixavam resíduo invisível de até 0,53 p.p.);
 * o resíduo estrutural restante é um SEGMENTO PRÓPRIO da pilha — nunca
 * escondido (regra do plano: resíduo estrutural é informação).
 *
 * Períodos de IGP-M 12m negativo ganham sombra (deflação — relevante p/
 * quem tem contrato indexado). Sem modo "12m empilhado": era o bug de soma
 * aritmética que este painel aposenta; a leitura de 12m vive no bloco 01.
 */

const NOMES_LEGENDA: Record<string, string> = {
  "IPA-M": "IPA (atacado)",
  "IPC-M": "IPC (varejo FGV)",
  "INCC-M": "INCC (construção)",
};

type Row = {
  mes: string;
  igpm: number | null;
  igpm12: number | null;
  residuo: number | null;
} & Record<string, number | string | null>;

export function AnchorDecomposicao({
  decomposicao,
  geradoEm,
}: {
  decomposicao: DecomposicaoBlock;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const componentes = decomposicao.componentes;

  const base = useMemo<Row[]>(
    () =>
      decomposicao.serie.map((r) => {
        const row: Row = {
          mes: r.mes,
          igpm: num(r, "IGP-M"),
          igpm12: num(r, "IGP-M 12m"),
          residuo: num(r, "residuo_pp"),
        };
        for (const c of componentes) {
          row[c] = num(r, `${c} (contrib)`);
          row[`${c} (peso)`] = num(r, `${c} (peso efetivo)`);
        }
        return row;
      }),
    [decomposicao.serie, componentes],
  );

  const minIso = base.length > 0 ? mesIso(base[0].mes) : "";
  const maxIso = base.length > 0 ? mesIso(base[base.length - 1].mes) : "";

  const rows = useMemo(() => {
    if (base.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return base.filter((r) => {
      const iso = mesIso(r.mes);
      return iso >= from && iso <= to;
    });
  }, [base, period, minIso, maxIso]);

  // Trechos contíguos de IGP-M 12m negativo (deflação) na janela visível.
  const deflacoes = useMemo(() => {
    const out: Array<{ x1: string; x2: string }> = [];
    let inicio: string | null = null;
    for (const r of rows) {
      const neg = r.igpm12 != null && r.igpm12 < 0;
      if (neg && inicio == null) inicio = r.mes;
      if (!neg && inicio != null) {
        out.push({ x1: inicio, x2: r.mes });
        inicio = null;
      }
    }
    if (inicio != null) out.push({ x1: inicio, x2: rows[rows.length - 1].mes });
    return out;
  }, [rows]);

  // Título afirmativo por regra: quem deu o tom no mês de referência.
  const ultimo = base[base.length - 1];
  const titulo = useMemo(() => {
    if (!ultimo || ultimo.igpm == null) return "IGP-M — decomposição por componente";
    let top: { c: string; v: number } | null = null;
    for (const c of componentes) {
      const v = ultimo[c];
      if (typeof v === "number" && (top == null || Math.abs(v) > Math.abs(top.v))) top = { c, v };
    }
    const leitura = top
      ? ` — ${nomeCurto(top.c)} respondeu por ${fmtSignedNum(top.v, 2)} p.p.`
      : "";
    return `IGP-M de ${fmtMesCurto(ultimo.mes)}: ${fmtSignedPct(ultimo.igpm, 2)}${leitura}`;
  }, [ultimo, componentes]);

  const pesoIpa = ultimo ? ultimo["IPA-M (peso)"] : null;

  return (
    <ChartCard
      title={titulo}
      subtitle={`O que move o IGP-M: atacado (IPA), varejo (IPC) ou construção (INCC)? Contribuições mensais em p.p. com pesos EFETIVOS encadeados${typeof pesoIpa === "number" ? ` — hoje o IPA pesa ${fmtPct(pesoIpa, 1)} do índice, não os 60% de origem` : ""}; o resíduo da aproximação é um segmento próprio da pilha.`}
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={minIso}
          max={maxIso}
          periods={["1y", "5y", "max"]}
        />
      }
      footer="Pesos efetivos = 60/30/10 aplicados aos números-índice encadeados no pipeline e renormalizados mês a mês (resíduo |médio| cai de 0,13 p.p. com pesos fixos para 0,08 p.p.). Faixas sombreadas = IGP-M 12m negativo (deflação — quem tem contrato indexado fica estável pela cláusula de não-redução)."
      stampGiro={geradoEm}
      stampDado={rows.length > 0 ? rows[rows.length - 1].mes : null}
    >
      {rows.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-zinc-400">
          Sem dados para o período selecionado.
        </p>
      ) : (
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="mes" tickFormatter={fmtMesCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtNum(v, 1)} />

              {deflacoes.map((d, i) => (
                <ReferenceArea
                  key={`defl-${i}`}
                  x1={d.x1}
                  x2={d.x2}
                  fill={AZ_BRAND.navy}
                  fillOpacity={0.05}
                  stroke="none"
                  label={
                    i === 0
                      ? { value: "IGP-M 12m negativo", position: "insideTopLeft", fontSize: 9, fill: AZ_CHART.ticks }
                      : undefined
                  }
                />
              ))}
              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

              <Tooltip
                content={
                  <AzTooltip
                    labelFmt={(l) => fmtMesCurto(String(l))}
                    valueFmt={(v, name) =>
                      name.startsWith("IGP-M") ? fmtSignedPct(v, 2) : `${fmtSignedNum(v, 2)} p.p.`
                    }
                  />
                }
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {componentes.map((c) => (
                <Bar
                  key={c}
                  dataKey={c}
                  name={NOMES_LEGENDA[c] ?? c}
                  stackId="comp"
                  fill={CORES_COMPONENTE[c] ?? AZ_CHART.ticks}
                  isAnimationActive={false}
                  maxBarSize={26}
                />
              ))}
              <Bar
                dataKey="residuo"
                name="Resíduo (aprox. dos pesos)"
                stackId="comp"
                fill={COR_RESIDUO}
                fillOpacity={0.55}
                isAnimationActive={false}
                maxBarSize={26}
              />
              <Line
                type="monotone"
                dataKey="igpm"
                name="IGP-M no mês"
                stroke={AZ_BRAND.rust}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
