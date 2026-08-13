"use client";

import { useMemo } from "react";
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

import type { DecomposicaoDlspAno } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtNum, fmtSignedNum } from "@/lib/format-br";

/**
 * "Por que a dívida subiu?" — decomposição ANUAL da variação da DLSP/PIB em
 * barras empilhadas COM SINAL (positivo empurra a dívida p/ cima): juros
 * nominais, resultado primário (o builder já grava com sinal p/ empilhar:
 * déficit positivo = aumenta dívida), efeito do crescimento do PIB nominal
 * (tipicamente negativo — o denominador cresce) e resíduo cinza (ajustes
 * patrimoniais/cambiais). O losango navy marca o Δ total do ano.
 *
 * O TÍTULO é verificado contra o dado: nomeia o maior fator médio da JANELA
 * dos últimos 10 anos (declarada no próprio título) — nunca afirma "foram os
 * juros" a priori. A média da série completa vai para o rodapé.
 */

const JANELA_ANOS = 10;

const COR_JUROS = AZ_BRAND.rust; // #FF5713
const COR_PRIMARIO = AZ_BRAND.azure; // #027DFC
const COR_CRESCIMENTO = "#1E8A5C"; // verde AZ_SERIES
const COR_RESIDUO = "#94A3B8"; // cinza — resíduo, fora da paleta narrativa

const FATORES = [
  { key: "juros", label: "Juros nominais", cor: COR_JUROS },
  { key: "primario", label: "Primário (déficit +)", cor: COR_PRIMARIO },
  { key: "crescimento", label: "Crescimento do PIB", cor: COR_CRESCIMENTO },
  { key: "residuo", label: "Ajustes patrimoniais/cambiais", cor: COR_RESIDUO },
] as const;

type LinhaFator = Record<(typeof FATORES)[number]["key"], number>;

/** Maior fator MÉDIO de um conjunto de anos — verificado no dado, não afirmado a priori. */
function fatorDominanteDe(subset: ReadonlyArray<LinhaFator>) {
  if (subset.length === 0) return null;
  const medias = FATORES.map((f) => ({
    ...f,
    media: subset.reduce((acc, r) => acc + r[f.key], 0) / subset.length,
  }));
  return medias.reduce((a, b) => (b.media > a.media ? b : a));
}

/** Losango navy do Δ total — injetado como dot da Line (Recharts clona com cx/cy). */
function DiamondDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx == null || cy == null) return null;
  const r = 4;
  return <path d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`} fill={AZ_BRAND.navy} />;
}

export function PorQueSubiuCard({ anos, geradoEm }: { anos: DecomposicaoDlspAno[]; geradoEm: string }) {
  const rows = useMemo(
    () =>
      anos.map((a) => ({
        ano: a.ano,
        juros: a.juros_pp,
        primario: a.primario_pp,
        crescimento: a.efeito_crescimento_pp,
        residuo: a.residuo_pp,
        delta: a.delta_pp,
      })),
    [anos],
  );

  // Janela dos últimos 10 anos p/ o título (declarada); série completa p/ o rodapé.
  const janela = useMemo(() => rows.slice(-JANELA_ANOS), [rows]);
  const fatorDominante = useMemo(() => fatorDominanteDe(janela), [janela]);
  const fatorHistorico = useMemo(() => fatorDominanteDe(rows), [rows]);

  const janelaLabel = janela.length > 0 ? `${janela[0].ano}–${janela[janela.length - 1].ano}` : "";

  const titulo = (() => {
    if (!fatorDominante) return "Por que a dívida subiu? A conta, fator a fator";
    if (fatorDominante.key === "juros")
      return `Por que a dívida subiu? Juros — não gasto primário (maior fator médio ${janelaLabel}: ${fmtSignedNum(fatorDominante.media, 1)} p.p./ano)`;
    if (fatorDominante.key === "primario")
      return `Por que a dívida subiu? O resultado primário pesou mais que os juros (maior fator médio ${janelaLabel}: ${fmtSignedNum(fatorDominante.media, 1)} p.p./ano)`;
    return `Por que a dívida subiu? Maior fator médio ${janelaLabel}: ${fatorDominante.label.toLowerCase()} (${fmtSignedNum(fatorDominante.media, 1)} p.p./ano)`;
  })();

  if (rows.length === 0) {
    return (
      <ChartCard title="Por que a dívida subiu?" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou a decomposição anual (schema v2). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const ult = rows[rows.length - 1];

  return (
    <ChartCard
      title={titulo}
      subtitle={`Variação anual da DLSP/PIB decomposta em pontos percentuais: barra acima de zero empurra a dívida p/ cima, abaixo puxa p/ baixo. O losango é o Δ total do ano (em ${ult.ano}: ${fmtSignedNum(ult.delta, 1)} p.p.).`}
      footer={`Identidade contábil no perímetro CONSOLIDADO (DLSP, fórmula única do pipeline): Δ(dívida/PIB) = juros nominais − primário − efeito do crescimento do PIB nominal + resíduo (ajustes patrimoniais/cambiais, reconhecimento de passivos). O primário já vem com sinal p/ empilhar: déficit primário positivo = aumenta a dívida. O título usa a janela dos últimos ${JANELA_ANOS} anos (${janelaLabel}).${
        fatorHistorico && rows.length > 0
          ? ` Na série completa (${rows[0].ano}–${rows[rows.length - 1].ano}), o maior fator médio é ${fatorHistorico.label.toLowerCase()} (${fmtSignedNum(fatorHistorico.media, 1)} p.p./ano).`
          : ""
      } A decomposição oficial da DBGG (Nota de Imprensa do BCB) entra quando coletada pelo pipeline.`}
      stampGiro={geradoEm}
      stampDado={`${ult.ano}-12-01`}
    >
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="ano" minTickGap={16} />
            <YAxis {...azYAxisProps()} width={48} tickFormatter={(v: number) => `${fmtNum(v, 0)} pp`} />

            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => String(l)}
                  valueFmt={(v) => `${fmtSignedNum(v, 1)} p.p.`}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {FATORES.map((f) => (
              <Bar
                key={f.key}
                dataKey={f.key}
                name={f.label}
                stackId="decomposicao"
                fill={f.cor}
                isAnimationActive={false}
                maxBarSize={26}
              />
            ))}
            <Line
              dataKey="delta"
              name="Δ DLSP no ano"
              stroke={AZ_BRAND.navy}
              strokeWidth={1.5}
              dot={<DiamondDot />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
