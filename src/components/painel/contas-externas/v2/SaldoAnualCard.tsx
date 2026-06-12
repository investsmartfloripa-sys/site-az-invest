"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SaldoAnualPonto } from "@/lib/painel-contas-externas";
import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedPct } from "@/lib/format-br";

/**
 * ÂNCORA do dashboard Contas Externas v2 — "o Brasil cabe no próprio bolso?".
 *
 * Barras anuais DIVERGENTES do saldo em transações correntes em % do PIB
 * (Cell por sinal), com as três réguas editoriais DECLARADAS no próprio
 * gráfico: banda ±2% do PIB (guia editorial), referência de risco em −4%
 * (a literatura de paradas bruscas é assimétrica: só déficit grande importa)
 * e a média histórica da própria série. Recessões CODACE sombreadas.
 */

/** Converte faixas CODACE ("2014-Q1"→"2016-Q4") em ranges de ANO da série anual, clipando. */
function codaceAnos(
  faixas: ReadonlyArray<CodaceFaixaAtividade> | undefined,
  anos: ReadonlyArray<string>,
): { x1: string; x2: string }[] {
  if (!faixas || anos.length === 0) return [];
  const anoNum = (s: string) => parseInt(s, 10);
  const out: { x1: string; x2: string }[] = [];
  for (const f of faixas) {
    if (f.tipo !== "recessao") continue;
    const a1 = anoNum(f.pico);
    const a2 = anoNum(f.vale);
    if (!Number.isFinite(a1) || !Number.isFinite(a2)) continue;
    const x1 = anos.find((a) => anoNum(a) >= a1);
    const x2 = [...anos].reverse().find((a) => anoNum(a) <= a2);
    if (x1 && x2 && anoNum(x1) <= anoNum(x2)) out.push({ x1, x2 });
  }
  return out;
}

export function SaldoAnualCard({
  saldoAnual,
  codaceTrimestral,
  geradoEm,
  ultimaReferencia,
}: {
  saldoAnual: SaldoAnualPonto[];
  codaceTrimestral?: CodaceFaixaAtividade[];
  geradoEm: string;
  ultimaReferencia: string | null;
}) {
  const ult = saldoAnual.length > 0 ? saldoAnual[saldoAnual.length - 1] : null;

  const media = useMemo(() => {
    if (saldoAnual.length === 0) return null;
    const soma = saldoAnual.reduce((acc, p) => acc + p.saldo_pct_pib, 0);
    return +(soma / saldoAnual.length).toFixed(2);
  }, [saldoAnual]);

  const faixas = useMemo(
    () => codaceAnos(codaceTrimestral, saldoAnual.map((p) => p.ano)),
    [codaceTrimestral, saldoAnual],
  );

  const titulo = useMemo(() => {
    if (!ult) return "Saldo em transações correntes (% do PIB)";
    const v = ult.saldo_pct_pib;
    if (v >= 0) return `O Brasil roda com superávit em conta corrente de ${fmtPct(v, 2)} do PIB — situação rara na série`;
    const abs = Math.abs(v);
    if (abs <= 2)
      return `O Brasil roda com déficit em conta corrente de ${fmtPct(abs, 2)} do PIB — dentro da banda editorial de ±2%`;
    if (abs <= 4)
      return `O Brasil roda com déficit em conta corrente de ${fmtPct(abs, 2)} do PIB — acima da banda de ±2%, abaixo da referência de risco de 4%`;
    return `O Brasil roda com déficit em conta corrente de ${fmtPct(abs, 2)} do PIB — acima da referência de risco de 4%`;
  }, [ult]);

  return (
    <ChartCard
      title={titulo}
      subtitle="Saldo anual de transações correntes em % do PIB desde 2000 — a pergunta-mãe das contas externas: o país financia o próprio crescimento? O ano corrente entra como janela móvel de 12 meses."
      footer="TC acumulada no ano (SGS 22701) ÷ PIB em US$ acumulado 12m (SGS 4192). Banda ±2% do PIB é GUIA EDITORIAL (não há consenso de literatura); déficits acima de 4% do PIB são a referência assimétrica de risco (paradas bruscas). Média histórica da própria série. Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={ultimaReferencia}
    >
      {saldoAnual.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou a série anual (saldo_anual).
        </p>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={saldoAnual} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={24} />
              <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => fmtSignedPct(v, 0)} />

              {faixas.map((f, i) =>
                f.x1 === f.x2 ? (
                  // Recessão contida em um único ano (ex.: 2020): no eixo categórico
                  // anual uma ReferenceArea x1===x2 teria largura zero — vira uma
                  // linha grossa translúcida sobre a categoria.
                  <ReferenceLine
                    key={`codace-${i}`}
                    x={f.x1}
                    stroke={AZ_CHART.ticks}
                    strokeOpacity={0.18}
                    strokeWidth={10}
                  />
                ) : (
                  <ReferenceArea
                    key={`codace-${i}`}
                    x1={f.x1}
                    x2={f.x2}
                    fill={AZ_CHART.ticks}
                    fillOpacity={0.07}
                    stroke="none"
                  />
                ),
              )}

              {/* Banda editorial ±2% do PIB — declarada, não "científica". */}
              <ReferenceArea
                y1={-2}
                y2={2}
                fill={AZ_BRAND.azure}
                fillOpacity={0.05}
                stroke="none"
                label={{ value: "±2% PIB (guia editorial)", position: "insideTopRight", fontSize: 9, fill: AZ_CHART.ticks }}
              />

              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

              <ReferenceLine
                y={-4}
                stroke={AZ_BRAND.rust}
                strokeDasharray="4 4"
                strokeWidth={1.2}
                label={{ value: "referência de risco (−4%)", position: "insideBottomRight", fontSize: 9, fill: AZ_BRAND.rust }}
              />

              {media != null ? (
                <ReferenceLine
                  y={media}
                  stroke={AZ_BRAND.navy}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  label={{
                    value: `média hist. ${fmtSignedPct(media, 1)}`,
                    position: "insideTopLeft",
                    fontSize: 9,
                    fill: AZ_BRAND.navy,
                  }}
                />
              ) : null}

              <Tooltip
                content={<AzTooltip labelFmt={(l) => String(l)} valueFmt={(v) => `${fmtSignedPct(v, 2)} do PIB`} />}
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />

              <Bar dataKey="saldo_pct_pib" name="Saldo TC (% PIB)" isAnimationActive={false} maxBarSize={22} radius={[2, 2, 0, 0]}>
                {saldoAnual.map((p) => (
                  <Cell key={p.ano} fill={variationFill(p.saldo_pct_pib, 0)} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
