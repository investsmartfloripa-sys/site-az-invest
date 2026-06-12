"use client";

import { useMemo } from "react";
import {
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

import type { CagedTotalData } from "@/lib/painel-emprego";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps, azZeroLineProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum } from "@/lib/format-br";
import { mesIso } from "@/components/painel/atividade/v2/shared";
import { MESES_CURTO_PT, fmtMil, somaYtd } from "./shared";

/**
 * "Em que pé está o ano?" — linhas de ACUMULAÇÃO jan→dez do saldo, uma por
 * ano. Substitui o "Top 5 melhores/piores meses" (trivia de COVID e
 * sazonalidade): a comparação honesta entre anos é SEMPRE no mesmo corte de
 * meses, e a corrida de linhas mostra isso de uma vez.
 */

const COR_ANO_ANTERIOR = AZ_CHART.ticks; // slate — destaque secundário
const COR_ANOS_ANTIGOS = "#CBD5E1"; // cinza claro — contexto

type RowYtd = { m: number } & Record<string, number | undefined>;

export function YtdCard({ total, geradoEm }: { total: CagedTotalData; geradoEm: string }) {
  const serie = total.serie;
  const ult = serie[serie.length - 1];
  const anoCorrente = parseInt(ult.mes.slice(0, 4), 10);
  const mesCorrente = parseInt(ult.mes.slice(5, 7), 10);

  const { rows, anos } = useMemo(() => {
    // Acumulado por ano × mês (em mil postos, 1 casa).
    const acum = new Map<number, Map<number, number>>();
    const running = new Map<number, number>();
    for (const r of serie) {
      if (r.saldo == null) continue;
      const y = parseInt(r.mes.slice(0, 4), 10);
      const m = parseInt(r.mes.slice(5, 7), 10);
      const soma = (running.get(y) ?? 0) + r.saldo;
      running.set(y, soma);
      if (!acum.has(y)) acum.set(y, new Map());
      acum.get(y)!.set(m, +(soma / 1000).toFixed(1));
    }
    const anosOrd = [...acum.keys()].sort((a, b) => a - b);
    const out: RowYtd[] = [];
    for (let m = 1; m <= 12; m++) {
      const row: RowYtd = { m };
      for (const y of anosOrd) {
        const v = acum.get(y)?.get(m);
        if (v != null) row[String(y)] = v;
      }
      out.push(row);
    }
    return { rows: out, anos: anosOrd };
  }, [serie]);

  // Título afirmativo: corrida do ano corrente vs anterior no MESMO corte.
  const ytdAtual = useMemo(() => somaYtd(serie, anoCorrente, mesCorrente), [serie, anoCorrente, mesCorrente]);
  const ytdAnterior = useMemo(() => somaYtd(serie, anoCorrente - 1, mesCorrente), [serie, anoCorrente, mesCorrente]);
  const titulo = (() => {
    if (ytdAtual == null) return "Saldo acumulado no ano, mês a mês";
    const base = `${anoCorrente} acumula ${fmtMil(ytdAtual)} postos até ${MESES_CURTO_PT[mesCorrente - 1]}`;
    if (ytdAnterior == null) return base;
    const diff = ytdAtual - ytdAnterior;
    if (Math.abs(diff) < 500) return `${base} — praticamente o mesmo que ${anoCorrente - 1} no mesmo corte`;
    return `${base} — ${fmtNum(Math.abs(diff) / 1000, 1)} mil ${diff > 0 ? "acima" : "abaixo"} de ${anoCorrente - 1} no mesmo corte`;
  })();

  const corDoAno = (y: number): string => {
    if (y === anoCorrente) return AZ_BRAND.azure;
    if (y === anoCorrente - 1) return COR_ANO_ANTERIOR;
    return COR_ANOS_ANTIGOS;
  };

  return (
    <ChartCard
      title={titulo}
      subtitle="Cada linha é um ano-calendário: soma do saldo cru de janeiro até cada mês (mil postos). O ano corrente (azul) para no último mês divulgado — compare sempre no mesmo corte."
      footer="Acumulado jan→mês do saldo cru (consolidado oficial MTE/IPEADATA). Rankings de 'melhores/piores meses' foram removidos: só capturavam o choque de 2020 e a sazonalidade de janeiro/dezembro, não informação econômica."
      stampGiro={geradoEm}
      stampDado={ult ? mesIso(ult.mes) : null}
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis
              {...azXAxisProps()}
              dataKey="m"
              interval={0}
              tickFormatter={(m: number) => MESES_CURTO_PT[m - 1] ?? String(m)}
            />
            <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => fmtNum(v, 0)} />
            <ReferenceLine {...azZeroLineProps("y")} />
            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => MESES_CURTO_PT[Number(l) - 1] ?? String(l)}
                  valueFmt={(v) => `${fmtNum(v, 1)} mil`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {anos.map((y) => (
              <Line
                key={y}
                type="monotone"
                dataKey={String(y)}
                name={String(y)}
                stroke={corDoAno(y)}
                strokeWidth={y === anoCorrente ? 2.5 : y === anoCorrente - 1 ? 1.6 : 1.1}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
