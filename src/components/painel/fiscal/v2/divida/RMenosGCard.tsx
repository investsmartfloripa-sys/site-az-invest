"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
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

import type { CodaceFaixaAtividade } from "@/lib/painel-atividade";
import type { SustentabilidadePonto } from "@/lib/painel-fiscal";
import { AzTooltip, ChartCard, azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_NEUTRAL_BAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { clipFaixasCategoria, codaceAreas, dataIso } from "./shared";

/**
 * r − g: o coração da aritmética de sustentabilidade da dívida. r = taxa
 * implícita NOMINAL da DLSP; g = crescimento NOMINAL do PIB em 12 meses —
 * nominal-nominal é o painel canônico p/ dinâmica de dívida (não confundir
 * com a Selic real de outros cards). Quando r > g a dívida cresce sozinha e
 * só superávit primário segura; quando r < g o crescimento corrói a dívida.
 *
 * Linhas de r e g + barras finas do GAP coloridas por sinal (vermelho r>g,
 * verde r<g) com RefLine 0 — tudo na mesma unidade (% a.a. / p.p.).
 * A anotação "% do tempo com r>g" é DERIVADA da janela visível.
 */

const COR_R = AZ_BRAND.rust; // custo da dívida
const COR_G = "#1E8A5C"; // crescimento nominal

/** Vermelho quando r>g (ruim p/ dívida), verde quando r<g — semântica INVERTIDA do variationFill. */
function corGap(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) <= AZ_NEUTRAL_BAND) return AZ_CHART.neutral;
  return v > 0 ? AZ_CHART.neg : AZ_CHART.pos;
}

function Chip({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm font-bold tabular-nums text-[#132960]">{valor}</p>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function RMenosGCard({
  serie,
  codaceMensal,
  geradoEm,
}: {
  serie: SustentabilidadePonto[];
  codaceMensal?: CodaceFaixaAtividade[];
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const minIso = serie.length > 0 ? dataIso(serie[0].data) : "";
  const maxIso = serie.length > 0 ? dataIso(serie[serie.length - 1].data) : "";

  const rows = useMemo(() => {
    if (serie.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return serie
      .map((p) => ({ iso: dataIso(p.data), r: p.r_aa_pct, g: p.g_aa_pct, gap: p.r_menos_g_pp }))
      .filter((p) => p.iso >= from && p.iso <= to);
  }, [serie, period, minIso, maxIso]);

  const faixas = useMemo(
    () => clipFaixasCategoria(codaceAreas(codaceMensal), rows.map((r) => r.iso)),
    [codaceMensal, rows],
  );

  // Anotação DERIVADA do dado: fração da janela visível com r > g.
  const pctTempoRMaior = useMemo(() => {
    if (rows.length === 0) return null;
    const n = rows.filter((p) => p.gap > 0).length;
    return +((100 * n) / rows.length).toFixed(0);
  }, [rows]);

  if (serie.length === 0) {
    return (
      <ChartCard title="r − g: o custo da dívida contra o crescimento" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou a série de sustentabilidade (schema v2). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const ult = serie[serie.length - 1];

  // Título afirmativo verificado contra o último dado.
  const titulo = (() => {
    if (ult.r_menos_g_pp > 0)
      return `O custo da dívida supera o crescimento nominal em ${fmtNum(ult.r_menos_g_pp, 1)} p.p. — a dinâmica pede primário`;
    if (ult.r_menos_g_pp < 0)
      return `O crescimento nominal supera o custo da dívida em ${fmtNum(Math.abs(ult.r_menos_g_pp), 1)} p.p. — vento a favor`;
    return "Custo da dívida e crescimento nominal empatados (r = g)";
  })();

  return (
    <ChartCard
      title={titulo}
      subtitle="r = taxa implícita nominal da DLSP; g = crescimento nominal do PIB em 12 meses. As barras finas são o gap r − g: vermelho quando r > g (a dívida cresce sozinha), verde quando r < g (o crescimento corrói a dívida)."
      toolbar={
        <AzPeriodSelector value={period} onChange={setPeriod} min={minIso} max={maxIso} periods={["1y", "5y", "max"]} />
      }
      footer="r = taxa implícita da DLSP (juros nominais 12m ÷ estoque médio); g = PIB nominal acumulado 12m, var. interanual. Painel nominal-nominal — o canônico p/ dinâmica de dívida (não confundir com a Selic real ex-post de outros cards). Perímetro único: setor público consolidado (DLSP), calculado SÓ no pipeline. Faixas cinzas: recessões CODACE/FGV (última datação: 2020)."
      stampGiro={geradoEm}
      stampDado={dataIso(ult.data)}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip label={`r (${fmtMesCurto(dataIso(ult.data))})`} valor={fmtPct(ult.r_aa_pct, 1)} hint="custo implícito, % a.a." />
        <Chip label="g (12m)" valor={fmtPct(ult.g_aa_pct, 1)} hint="PIB nominal, % a.a." />
        <Chip label="r − g" valor={`${fmtSignedNum(ult.r_menos_g_pp, 1)} p.p.`} hint="positivo = contra a dívida" />
        {pctTempoRMaior != null ? (
          <Chip label="r > g na janela" valor={fmtPct(pctTempoRMaior, 0)} hint="dos meses visíveis" />
        ) : null}
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...azGridProps()} />
            <XAxis {...azXAxisProps()} dataKey="iso" tickFormatter={fmtMesCurto} minTickGap={32} />
            <YAxis {...azYAxisProps()} width={44} tickFormatter={(v: number) => `${fmtNum(v, 0)}%`} />

            {faixas.map((f, i) => (
              <ReferenceArea key={`codace-${i}`} x1={f.x1} x2={f.x2} fill={AZ_CHART.ticks} fillOpacity={0.07} stroke="none" />
            ))}

            <ReferenceLine y={0} stroke={AZ_CHART.zero} strokeOpacity={AZ_CHART.zeroOpacity} strokeWidth={1.5} />

            <Tooltip
              content={
                <AzTooltip
                  labelFmt={(l) => fmtMesCurto(String(l))}
                  valueFmt={(v, name) => (name.startsWith("r − g") ? `${fmtSignedNum(v, 2)} p.p.` : fmtPct(v, 2))}
                />
              }
              cursor={AZ_TOOLTIP_PROPS.cursor}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar dataKey="gap" name="r − g (gap)" isAnimationActive={false} maxBarSize={6}>
              {rows.map((p) => (
                <Cell key={p.iso} fill={corGap(p.gap)} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="r" name="r — custo implícito" stroke={COR_R} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="g" name="g — PIB nominal 12m" stroke={COR_G} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
