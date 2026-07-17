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

  // Tabela de contribuição por grupo ao IPCA de 12 meses (último ponto).
  const ultimo = contrib12[contrib12.length - 1];
  const ipca12 = ultimo ? num(ultimo, "IPCA 12m") : null;
  const tabelaGrupos = useMemo(() => {
    if (!ultimo) return [] as Array<{ grupo: string; contrib: number }>;
    return grupos
      .map((g) => ({ grupo: nomeGrupo(g), contrib: num(ultimo, g) }))
      .filter((r): r is { grupo: string; contrib: number } => r.contrib != null)
      .sort((a, b) => b.contrib - a.contrib);
  }, [ultimo, grupos]);

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
                  <ReferenceLine
                    y={META}
                    stroke={AZ_BRAND.navy}
                    strokeDasharray="4 4"
                    strokeWidth={1.2}
                    label={{ value: "meta contínua 3,0%", position: "insideBottomRight", fontSize: 9, fill: AZ_BRAND.navy }}
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
              <Legend wrapperStyle={{ fontSize: 11 }} />

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
      {tabelaGrupos.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-100">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-zinc-700">Grupo</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Contrib. 12m (p.p.)</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-zinc-700">Share do IPCA (%)</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {tabelaGrupos.map((r) => (
                <tr key={r.grupo} className="border-t border-zinc-50 hover:bg-zinc-50/60">
                  <td className="whitespace-nowrap px-3 py-1.5 text-zinc-800">{r.grupo}</td>
                  <td
                    className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums"
                    style={{ color: r.contrib > 0 ? AZ_CHART.negText : r.contrib < 0 ? AZ_CHART.neutral : undefined }}
                  >
                    {fmtSignedNum(r.contrib, 3)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-600">
                    {ipca12 != null && ipca12 !== 0 ? fmtNum((r.contrib / ipca12) * 100, 1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </ChartCard>
  );
}
