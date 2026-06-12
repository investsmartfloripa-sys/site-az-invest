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

import type { AtividadePibData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import { LABELS_PIB_FALLBACK } from "@/lib/painel-atividade";
import { AzSegmented, AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_SERIES, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "../shared";

/**
 * ÂNCORA do Painel PIB v2 — "o que puxou (e o que segurou) o crescimento?".
 *
 * O gráfico canônico de research macro e do Relatório de Inflação do BCB:
 * barras EMPILHADAS de contribuição ponderada (p.p., peso nominal t-4 do
 * builder) + linha do PIB YoY. Abre na ótica da DEMANDA (nunca em branco).
 * Importações já vêm com sinal trocado do builder; o resíduo absorve a
 * não-aditividade do encadeamento (+ estoques na demanda).
 */

type Otica = "demanda" | "oferta";

const OFERTA_KEYS = ["oferta_agro", "oferta_industria", "oferta_servicos", "oferta_impostos", "oferta_residuo"] as const;
const DEMANDA_KEYS = [
  "demanda_consumo_familias",
  "demanda_consumo_governo",
  "demanda_fbcf",
  "demanda_exportacoes",
  "demanda_importacoes",
  "demanda_residuo",
] as const;

const KEY_LABEL: Record<string, string> = {
  oferta_agro: LABELS_PIB_FALLBACK.agro,
  oferta_industria: LABELS_PIB_FALLBACK.industria,
  oferta_servicos: LABELS_PIB_FALLBACK.servicos,
  oferta_impostos: "Impostos líquidos",
  oferta_residuo: "Resíduo (encadeamento)",
  demanda_consumo_familias: LABELS_PIB_FALLBACK.consumo_familias,
  demanda_consumo_governo: LABELS_PIB_FALLBACK.consumo_governo,
  demanda_fbcf: LABELS_PIB_FALLBACK.fbcf,
  demanda_exportacoes: LABELS_PIB_FALLBACK.exportacoes,
  demanda_importacoes: "Importações (−)",
  demanda_residuo: "Estoques + resíduo",
};

const RESIDUO_COLOR = "#94A3B8";

function corDaPilha(key: string, i: number): string {
  if (key.endsWith("_residuo")) return RESIDUO_COLOR;
  return AZ_SERIES[i % AZ_SERIES.length];
}

/** Converte faixas CODACE trimestrais ("2014-Q1") nos keys de trim visíveis, clipando à janela. */
function codaceTrims(faixas: ReadonlyArray<CodaceFaixaAtividade> | undefined, trims: string[]): { x1: string; x2: string }[] {
  if (!faixas || trims.length === 0) return [];
  const out: { x1: string; x2: string }[] = [];
  for (const f of faixas) {
    const pico = f.pico.replace(/-Q(\d)$/, (_, q) => `-T0${q}`);
    const vale = f.vale.replace(/-Q(\d)$/, (_, q) => `-T0${q}`);
    if (vale < trims[0] || pico > trims[trims.length - 1]) continue;
    const x1 = trims.find((t) => t >= pico) ?? trims[0];
    const x2 = [...trims].reverse().find((t) => t <= vale) ?? trims[trims.length - 1];
    if (x1 <= x2) out.push({ x1, x2 });
  }
  return out;
}

export function AnchorContribuicoesPib({
  pib,
  codaceTrimestral,
  geradoEm,
}: {
  pib: AtividadePibData;
  codaceTrimestral?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [otica, setOtica] = useState<Otica>("demanda");
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "5y" });

  const serie = pib.contribuicoes?.serie ?? [];
  const minIso = serie.length > 0 ? trimIsoCentral(serie[0].trim) : "";
  const maxIso = serie.length > 0 ? trimIsoCentral(serie[serie.length - 1].trim) : "";

  const rows = useMemo(() => {
    if (serie.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return serie.filter((r) => {
      const iso = trimIsoCentral(r.trim);
      return iso >= from && iso <= to;
    });
  }, [serie, period, minIso, maxIso]);

  const keys = otica === "demanda" ? DEMANDA_KEYS : OFERTA_KEYS;
  const trimsVisiveis = rows.map((r) => r.trim);
  const faixas = useMemo(() => codaceTrims(codaceTrimestral, trimsVisiveis), [codaceTrimestral, trimsVisiveis]);

  // Título afirmativo: maior contribuição (excl. resíduo) do trimestre mais recente.
  const ult = serie[serie.length - 1];
  const top = useMemo(() => {
    if (!ult) return null;
    let melhor: { key: string; v: number } | null = null;
    for (const k of keys) {
      if (k.endsWith("_residuo")) continue;
      const v = num(ult, k);
      if (v != null && (melhor == null || v > melhor.v)) melhor = { key: k, v };
    }
    return melhor;
  }, [ult, keys]);

  const titulo = ult
    ? `PIB cresceu ${fmtPct(ult.pib_yoy, 1)} em 12 meses no ${fmtTrimCurto(ult.trim)}${
        top ? ` — maior motor: ${KEY_LABEL[top.key]} (${fmtSignedNum(top.v, 1)} p.p.)` : ""
      }`
    : "PIB — contribuições ao crescimento";

  return (
    <ChartCard
      title={titulo}
      subtitle="O que puxou (e o que segurou) o crescimento? Contribuição ponderada de cada componente em pontos percentuais — as barras somam (≈) a linha do PIB."
      toolbar={
        <>
          <AzSegmented
            ariaLabel="Ótica da decomposição"
            options={[
              { id: "demanda", label: "Demanda" },
              { id: "oferta", label: "Oferta" },
            ]}
            value={otica}
            onChange={(id) => setOtica(id as Otica)}
          />
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
        </>
      }
      footer="Contribuição = peso nominal do mesmo trimestre do ano anterior (SIDRA 1846, convenção t-4) × variação real YoY (5932). Importações entram com sinal trocado. Índices encadeados são não-aditivos: o resíduo absorve a diferença (na demanda, também a variação de estoques). Faixas cinzas: recessões CODACE/FGV."
      stampGiro={geradoEm}
      stampDado={ult ? trimIsoCentral(ult.trim) : null}
    >
      {rows.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou as contribuições (schema v2). Rode o workflow atividade-pipeline.yml.
        </p>
      ) : (
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="trim" tickFormatter={fmtTrimCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => fmtSignedNum(v, 0)} />

              {faixas.map((f, i) => (
                <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
              ))}

              <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

              <Tooltip
                content={
                  <AzTooltip
                    labelFmt={(l) => fmtTrimCurto(String(l))}
                    valueFmt={(v, name) => (name.startsWith("PIB") ? fmtSignedPct(v, 1) : `${fmtSignedNum(v, 2)} p.p.`)}
                  />
                }
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={KEY_LABEL[k]}
                  stackId="contrib"
                  fill={corDaPilha(k, i)}
                  isAnimationActive={false}
                  maxBarSize={26}
                />
              ))}
              <Line
                type="monotone"
                dataKey="pib_yoy"
                name="PIB (YoY)"
                stroke={AZ_BRAND.navy}
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
