"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Decomposicao12mBlock } from "@/lib/painel-igpm";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { fmtMesCurto, fmtNum, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { mesIso } from "../v2/shared";
import { CORES_COMPONENTE, COR_RESIDUO } from "../v2igpm/shared";

/**
 * Composição do acumulado 12m — espelho visual da AnchorDecomposicao mensal:
 * barras EMPILHADAS da contribuição de cada componente ao IGP-M 12m + linha
 * do IGP-M 12m oficial. As contribuições vêm do builder por ENCADEAMENTO das
 * contribs mensais (pesos efetivos); o resíduo é fatia PRÓPRIA da pilha e a
 * soma fecha com o oficial por construção — nunca realocado.
 */

const NOMES_LEGENDA: Record<string, string> = {
  "IPA-M": "IPA (atacado)",
  "IPC-M": "IPC (varejo FGV)",
  "INCC-M": "INCC (construção)",
};

export function Decomposicao12mCard({ decomp, geradoEm }: { decomp: Decomposicao12mBlock; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const componentes = decomp.componentes;

  const minIso = decomp.serie.length > 0 ? mesIso(decomp.serie[0].mes) : "";
  const maxIso = decomp.serie.length > 0 ? mesIso(decomp.serie[decomp.serie.length - 1].mes) : "";

  const rows = useMemo(() => {
    if (decomp.serie.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return decomp.serie.filter((r) => {
      const iso = mesIso(r.mes);
      return iso >= from && iso <= to;
    });
  }, [decomp.serie, period, minIso, maxIso]);

  if (decomp.serie.length === 0) return null;

  return (
    <ChartCard
      title="Composição do acumulado 12 meses"
      toolbar={
        <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
      }
      footer="Contribuição de cada componente ao IGP-M 12m por ENCADEAMENTO das contribuições mensais (pesos efetivos), calculada no pipeline. A fatia de resíduo fecha a pilha exatamente com o IGP-M 12m oficial por construção e NUNCA é realocada entre componentes — resíduo estrutural é informação."
      stampGiro={geradoEm}
      stampDado={decomp.serie.at(-1)?.mes ?? null}
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
              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

              <Tooltip
                content={
                  <AzTooltip
                    labelFmt={(l) => fmtMesCurto(String(l))}
                    valueFmt={(v, name) =>
                      name === "IGP-M 12m" ? fmtSignedPct(v, 2) : `${fmtSignedNum(v, 2)} p.p.`
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
                name="Resíduo (fatia própria)"
                stackId="comp"
                fill={COR_RESIDUO}
                fillOpacity={0.55}
                isAnimationActive={false}
                maxBarSize={26}
              />
              <Line
                type="monotone"
                dataKey="IGP-M 12m"
                name="IGP-M 12m"
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
