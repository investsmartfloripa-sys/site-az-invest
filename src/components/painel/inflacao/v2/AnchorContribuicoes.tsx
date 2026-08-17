"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IpcaIndice, SerieGrupo } from "@/lib/painel-ipca";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_SERIES, AZ_SERIES_EXTRA, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { META, META_PISO, META_TETO, mesIso, nomeGrupo, num } from "./shared";

/**
 * ÂNCORA do Painel IPCA v2 — "o que empurra a inflação e ela cabe na meta?".
 *
 * Formato canônico do Relatório de Inflação: barras EMPILHADAS de contribuição
 * por grupo + linha do índice cheio. Default 12 meses, com a pilha vinda do
 * builder (encadeada, fecha exatamente com o IPCA 12m oficial v2265 — nunca
 * recalculada aqui). Banda da meta em cinza-azulado NEUTRO + tracejada em
 * 3,0% ("meta contínua"); no modo mensal a banda some — meta não é mensal.
 * Sem modo "Linhas" (contribuição se lê empilhada).
 */

const GROUP_COLORS = [...AZ_SERIES, AZ_SERIES_EXTRA];

type Visao = "12m" | "mensal";

export function AnchorContribuicoes({ indice, geradoEm }: { indice: IpcaIndice; geradoEm: string }) {
  const [visao, setVisao] = useState<Visao>("12m");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const grupos = indice.grupos;
  const contrib12 = indice.serie_contrib_12m ?? [];

  // Modo mensal: contribuições var×peso÷100 já vêm prontas na serie ("<g> (contrib)").
  const mensal = useMemo<SerieGrupo[]>(
    () =>
      indice.serie.map((row) => {
        const o: SerieGrupo = { mes: row.mes, "IPCA cheio": num(row, "IPCA cheio") };
        for (const g of grupos) o[g] = num(row, `${g} (contrib)`);
        return o;
      }),
    [indice.serie, grupos],
  );

  const base = visao === "12m" ? contrib12 : mensal;
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

  const linhaKey = visao === "12m" ? "IPCA 12m" : "IPCA cheio";
  const linhaNome = visao === "12m" ? "IPCA 12m (oficial)" : "IPCA do mês";

  return (
    <ChartCard
      title="Contribuição por grupo ao IPCA"
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Janela da contribuição"
            options={[
              { id: "12m", label: "12 meses" },
              { id: "mensal", label: "Mensal" },
            ]}
            value={visao}
            onChange={(id) => setVisao(id as Visao)}
          />
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso}
            max={maxIso}
            periods={["1y", "5y", "max"]}
          />
        </>
      }
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

              {visao === "12m" ? (
                <>
                  {/* Banda da meta em cinza-azulado NEUTRO (não é "zona boa"). */}
                  <ReferenceArea
                    y1={META_PISO}
                    y2={META_TETO}
                    fill={AZ_CHART.ticks}
                    fillOpacity={0.08}
                    stroke="none"
                    label={{ value: "banda da meta", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
                  />
                  {/* Meta em BRANCO: a linha cruza a pilha de barras coloridas —
                      em navy ela sumia dentro das faixas escuras (relatório do
                      editor, ago/2026). Halo escuro por baixo garante contraste
                      também onde a pilha é clara ou o fundo é o do card. */}
                  <ReferenceLine
                    y={META}
                    stroke="rgba(19,41,96,0.55)"
                    strokeWidth={3.2}
                    ifOverflow="extendDomain"
                  />
                  <ReferenceLine
                    y={META}
                    stroke="#ffffff"
                    strokeDasharray="4 4"
                    strokeWidth={1.6}
                    label={{
                      value: "meta contínua 3,0%",
                      position: "insideBottomRight",
                      fontSize: 9,
                      fill: "#ffffff",
                      stroke: "rgba(19,41,96,0.65)",
                      strokeWidth: 2.4,
                      paintOrder: "stroke",
                    }}
                  />
                </>
              ) : null}
              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

              <Tooltip
                content={
                  <AzTooltip
                    labelFmt={(l) => fmtMesCurto(String(l))}
                    valueFmt={(v, name) =>
                      name.startsWith("IPCA") ? fmtPct(v, 2) : `${fmtSignedNum(v, 2)} p.p.`
                    }
                  />
                }
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              {/* Legenda na lateral DIREITA, em coluna: são 10 séries e na
                  horizontal elas ocupavam duas linhas embaixo do gráfico. */}
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 11, lineHeight: "18px", paddingLeft: 12 }}
              />

              {grupos.map((g, i) => (
                <Bar
                  key={g}
                  dataKey={g}
                  name={nomeGrupo(g)}
                  stackId="grupos"
                  fill={GROUP_COLORS[i % GROUP_COLORS.length]}
                  isAnimationActive={false}
                  maxBarSize={26}
                />
              ))}
              <Line
                type="monotone"
                dataKey={linhaKey}
                name={linhaNome}
                stroke={AZ_BRAND.navy}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* A tabela de contribuição 12m que vivia acoplada ao gráfico saiu na
          revisão ago/2026 do editor: "deixe apenas o gráfico". Os mesmos
          números estão na tabela-síntese e no tooltip de cada barra. */}
    </ChartCard>
  );
}
