"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Balanca12mPonto } from "@/lib/painel-contas-externas";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum } from "@/lib/format-br";
import { filtraPeriodoMes, fmtUsBi, mesIso, num, ultimo } from "./shared";

/**
 * Bloco 02 — "o superávit comercial cresce?". Exportações e importações de
 * bens (BPM6) acumuladas em 12m como LINHAS + saldo como ÁREA, com o recorde
 * histórico do saldo anotado (derivado da própria série, não hard-coded).
 */

const COR_EXPORT = AZ_SERIES[3]; // verde-mar
const COR_IMPORT = AZ_SERIES[2]; // rust

export function Balanca12mCard({ balanca12m, geradoEm }: { balanca12m: Balanca12mPonto[]; geradoEm: string }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const rows = useMemo(() => filtraPeriodoMes(balanca12m, period), [balanca12m, period]);
  const minIso = balanca12m.length > 0 ? mesIso(balanca12m[0].mes) : "";
  const maxIso = balanca12m.length > 0 ? mesIso(balanca12m[balanca12m.length - 1].mes) : "";

  // Recorde do saldo 12m na série COMPLETA (independe da janela exibida).
  const recorde = useMemo(() => {
    let best: { mes: string; v: number } | null = null;
    for (const p of balanca12m) {
      const v = num(p, "saldo");
      if (v != null && (best == null || v > best.v)) best = { mes: p.mes, v };
    }
    return best;
  }, [balanca12m]);

  const ultSaldo = ultimo(balanca12m, "saldo");

  const titulo = useMemo(() => {
    if (!ultSaldo) return "Balança comercial de bens — acumulado 12 meses";
    const v = ultSaldo.valor;
    if (v < 0) return `A balança de bens acumula déficit de ${fmtUsBi(Math.abs(v))} em 12 meses`;
    if (recorde && recorde.mes === ultSaldo.row.mes)
      return `O superávit comercial soma ${fmtUsBi(v)} em 12 meses — recorde da série`;
    return `O superávit comercial soma ${fmtUsBi(v)} em 12 meses${
      recorde ? ` — recorde: ${fmtUsBi(recorde.v)} em ${fmtMesCurto(mesIso(recorde.mes))}` : ""
    }`;
  }, [ultSaldo, recorde]);

  const recordeVisivel = recorde != null && rows.some((r) => r.mes === recorde.mes);

  return (
    <ChartCard
      title={titulo}
      subtitle="Exportações e importações de bens (BPM6) acumuladas em 12 meses; a área azul é o saldo. US$ bilhões."
      toolbar={<AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />}
      footer="Bens BPM6 acumulados 12m: exportações SGS 22711, saldo 22707, importações por identidade. O saldo BPM6 difere do saldo aduaneiro da SECEX/Comex Stat: o BPM6 segue a mudança de propriedade econômica (plataformas, reexportações, mercadorias sem cruzar fronteira) — diferenças de alguns US$ bi são esperadas e não são erro."
      stampGiro={geradoEm}
      stampDado={ultSaldo ? mesIso(ultSaldo.row.mes) : null}
    >
      {rows.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-zinc-400">
          Sem dados para o período selecionado.
        </p>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis
                {...azXAxisProps()}
                dataKey="mes"
                tickFormatter={(m: string) => fmtMesCurto(mesIso(m))}
                minTickGap={28}
              />
              <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => fmtNum(v, 0)} />

              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

              <Tooltip
                content={<AzTooltip labelFmt={(l) => fmtMesCurto(mesIso(String(l)))} valueFmt={(v) => fmtUsBi(v, 1)} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              <Area
                type="monotone"
                dataKey="saldo"
                name="Saldo (12m)"
                stroke={AZ_BRAND.azure}
                strokeWidth={2}
                fill={AZ_BRAND.azure}
                fillOpacity={0.14}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="exportacoes"
                name="Exportações (12m)"
                stroke={COR_EXPORT}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="importacoes"
                name="Importações (12m)"
                stroke={COR_IMPORT}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />

              {recordeVisivel && recorde ? (
                <ReferenceDot
                  x={recorde.mes}
                  y={recorde.v}
                  r={3}
                  fill={AZ_BRAND.navy}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  label={{
                    value: `recorde: ${fmtUsBi(recorde.v, 0)}`,
                    position: "top",
                    offset: 8,
                    fontSize: 9,
                    fill: AZ_BRAND.navy,
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
