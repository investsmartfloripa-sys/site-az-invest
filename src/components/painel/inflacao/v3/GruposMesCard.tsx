"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AberturaHierarquica, TabelaSinteseBlock } from "@/lib/painel-ipca";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { META } from "../v2/shared";

/**
 * Os 9 grupos do IPCA em UM card (revisão ago/2026 do editor: antes eram dois
 * cards lado a lado, "quanto subiu" e "quanto pesou"), agora como colunas
 * verticais pareadas por grupo.
 *
 * As duas leituras têm unidade e ordem de grandeza diferentes — no mês, +0,99%
 * de variação contra +0,152 p.p. de contribuição. Por isso DOIS eixos: o
 * esquerdo em % (variação de preço), o direito em p.p. (quanto isso empurrou o
 * índice). Um eixo só achataria a contribuição até virar um traço.
 *
 * Semântica de inflação: alta = vermelho (pressão), queda = azul.
 */

type Horizonte = "mes" | "acum_12m";

const HORIZONTES = [
  { id: "mes", label: "No mês" },
  { id: "acum_12m", label: "Em 12 meses" },
];

export function GruposMesCard({
  hierarquia,
  sintese,
  mesRef,
  geradoEm,
}: {
  hierarquia: AberturaHierarquica;
  /** Traz a variação % por grupo (mês e 12m). Sem ela, o card mostra só contribuição. */
  sintese?: TabelaSinteseBlock;
  mesRef: string;
  geradoEm: string;
}) {
  const [horizonte, setHorizonte] = useState<Horizonte>("mes");

  const rows = useMemo(() => {
    // Variação % por grupo vem da síntese; contribuição do mês, da hierarquia.
    const linhasSintese = sintese?.secoes.find((s) => s.id === "grupos")?.linhas ?? [];
    const varPorNome = new Map(
      linhasSintese.map((l) => [l.nome, horizonte === "mes" ? l.m0 : l.acum_12m] as const),
    );
    const contribPorNome = new Map(hierarquia.grupos.map((g) => [g.nome, g.contrib_pp] as const));
    const contrib12PorNome = new Map(
      linhasSintese.map((l) => [l.nome, l.contrib_pp ?? null] as const),
    );

    const nomes = linhasSintese.length > 0 ? linhasSintese.map((l) => l.nome) : hierarquia.grupos.map((g) => g.nome);

    return nomes
      .map((nome) => ({
        nome,
        variacao: varPorNome.get(nome) ?? null,
        // Contribuição de 12 meses só existe no mês corrente na hierarquia;
        // no horizonte de 12m usamos a da síntese quando o builder mandou.
        contrib: horizonte === "mes" ? (contribPorNome.get(nome) ?? null) : (contrib12PorNome.get(nome) ?? null),
      }))
      .filter((r) => r.variacao != null || r.contrib != null)
      .sort((a, b) => (b.variacao ?? b.contrib ?? 0) - (a.variacao ?? a.contrib ?? 0));
  }, [hierarquia, sintese, horizonte]);

  const temContrib = rows.some((r) => r.contrib != null);
  if (rows.length === 0) return null;

  const unidadeVar = horizonte === "mes" ? "no mês" : "em 12 meses";

  return (
    <ChartCard
      title={`Os 9 grupos do IPCA (${horizonte === "mes" ? fmtMesCurto(mesRef) : "12 meses"})`}
      subtitle="Duas leituras do mesmo grupo: quanto o preço dele subiu (coluna escura, eixo da esquerda) e quanto isso empurrou o IPCA (coluna clara, eixo da direita, já descontado o peso do grupo na cesta)."
      toolbar={
        <AzSegmented
          ariaLabel="Horizonte dos grupos"
          options={HORIZONTES}
          value={horizonte}
          onChange={(id) => setHorizonte(id as Horizonte)}
        />
      }
      footer={
        <>
          <p className="mb-1.5">
            <strong>Por que dois eixos.</strong> Variação e contribuição têm unidades diferentes e ordens de grandeza
            muito distantes: Habitação subiu +0,99% {unidadeVar} mas contribuiu +0,152 p.p. para o índice. Num eixo só,
            a coluna de contribuição viraria um traço. O eixo da esquerda (%) vale para a coluna escura; o da direita
            (p.p.), para a clara.
          </p>
          <p>
            <strong>Como usar.</strong> Grupo com coluna escura alta e clara baixa subiu muito mas pesa pouco no
            orçamento — barulho, não pressão. O contrário (clara alta) é o que de fato move o IPCA. A soma das colunas
            claras do mês fecha exatamente com o índice cheio. Em 12 meses, a linha tracejada marca a meta de{" "}
            {fmtPct(META, 1)}.
          </p>
        </>
      }
      stampGiro={geradoEm}
      stampDado={mesRef}
    >
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 64, left: 0 }} barGap={2}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="nome"
              interval={0}
              angle={-35}
              textAnchor="end"
              height={72}
              tick={{ fontSize: 10, fill: AZ_CHART.labels }}
            />
            <YAxis
              {...azYAxisProps()}
              yAxisId="var"
              width={46}
              tickFormatter={(v: number) => `${fmtNum(v, 1)}%`}
            />
            {temContrib ? (
              <YAxis
                {...azYAxisProps()}
                yAxisId="contrib"
                orientation="right"
                width={52}
                tickFormatter={(v: number) => fmtNum(v, 2)}
              />
            ) : null}
            <ReferenceLine
              yAxisId="var"
              y={0}
              stroke={AZ_CHART.zero}
              strokeOpacity={AZ_CHART.zeroOpacity}
              strokeWidth={1.5}
            />
            {horizonte === "acum_12m" ? (
              <ReferenceLine
                yAxisId="var"
                y={META}
                stroke={AZ_BRAND.navy}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{ value: `meta ${fmtPct(META, 1)}`, position: "insideTopRight", fontSize: 9, fill: AZ_BRAND.navy }}
              />
            ) : null}
            <Tooltip
              content={
                <AzTooltip
                  valueFmt={(v, name) =>
                    name.startsWith("Contribuição") ? `${fmtSignedNum(v, 3)} p.p.` : fmtSignedPct(v, 2)
                  }
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />

            <Bar
              yAxisId="var"
              dataKey="variacao"
              name={`Variação de preço (%) — eixo esquerdo`}
              maxBarSize={22}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.nome} fill={(r.variacao ?? 0) > 0 ? AZ_CHART.neg : AZ_CHART.neutral} />
              ))}
            </Bar>
            {temContrib ? (
              <Bar
                yAxisId="contrib"
                dataKey="contrib"
                name="Contribuição ao IPCA (p.p.) — eixo direito"
                maxBarSize={22}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                {rows.map((r) => (
                  <Cell
                    key={r.nome}
                    fill={(r.contrib ?? 0) > 0 ? AZ_CHART.neg : AZ_CHART.neutral}
                    fillOpacity={0.42}
                  />
                ))}
              </Bar>
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
