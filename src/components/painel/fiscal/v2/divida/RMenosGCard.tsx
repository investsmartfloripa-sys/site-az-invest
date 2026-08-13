"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import { AZ_CHART, AZ_NEUTRAL_BAND, AZ_TOOLTIP_PROPS } from "@/lib/az-chart-theme";
import { fmtMesCurto, fmtNum, fmtPct, fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { CockpitChip, clipFaixasCategoria, codaceAreas, dataIso } from "./shared";

/**
 * r − g: o coração da aritmética de sustentabilidade da dívida. r = taxa
 * implícita NOMINAL da DLSP; g = crescimento NOMINAL do PIB em 12 meses —
 * nominal-nominal é o painel canônico p/ dinâmica de dívida (não confundir
 * com a Selic real de outros cards). Quando r > g a dívida cresce sozinha e
 * só superávit primário segura; quando r < g o crescimento corrói a dívida.
 *
 * Padrão cockpit: título FIXO técnico + chip do gap atual; leitura no footer
 * (?). Cores canônicas fiscais: r = navy #132960 (custo da dívida),
 * g = azure #027DFC (crescimento) — as mesmas da aba de risco. SEM <Legend>:
 * os chips abaixo do título exibem cor + label + valor (legenda seria dupla).
 * A anotação "% do tempo com r>g" é DERIVADA da janela visível.
 */

const COR_R = "#132960"; // navy — custo da dívida (canônico fiscal)
const COR_G = "#027DFC"; // azure — crescimento nominal (canônico fiscal)

/** Vermelho quando r>g (ruim p/ dívida), verde quando r<g — semântica INVERTIDA do variationFill. */
function corGap(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) <= AZ_NEUTRAL_BAND) return AZ_CHART.neutral;
  return v > 0 ? "#BE3B33" : "#1E8A5C";
}

function Chip({ label, valor, hint, cor }: { label: string; valor: string; hint?: string; cor?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {cor ? <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} aria-hidden /> : null}
        {label}
      </p>
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
      <ChartCard title="r − g e primário estabilizador (SP)" stampGiro={geradoEm}>
        <p className="flex h-64 items-center justify-center text-sm text-zinc-400">
          O pipeline ainda não publicou a série de sustentabilidade (schema v2). Rode o workflow fiscal-pipeline.yml.
        </p>
      </ChartCard>
    );
  }

  const ult = serie[serie.length - 1];

  // Leitura interpretativa verificada contra o último dado — footer (?), nunca título.
  const leitura = (() => {
    if (ult.r_menos_g_pp > 0)
      return `O custo da dívida supera o crescimento nominal em ${fmtNum(ult.r_menos_g_pp, 1)} p.p. — a dinâmica pede primário.`;
    if (ult.r_menos_g_pp < 0)
      return `O crescimento nominal supera o custo da dívida em ${fmtNum(Math.abs(ult.r_menos_g_pp), 1)} p.p. — vento a favor.`;
    return "Custo da dívida e crescimento nominal empatados (r = g).";
  })();

  return (
    <ChartCard
      title="r − g e primário estabilizador (SP)"
      subtitle="r = taxa implícita nominal da DLSP; g = crescimento nominal do PIB em 12 meses. As barras finas são o gap r − g: vermelho quando r > g (a dívida cresce sozinha), verde quando r < g (o crescimento corrói a dívida)."
      toolbar={
        <>
          <CockpitChip cor={ult.r_menos_g_pp > 0 ? "#BE3B33" : ult.r_menos_g_pp < 0 ? "#1E8A5C" : "#132960"}>
            r − g {fmtSignedNum(ult.r_menos_g_pp, 1)} p.p.
          </CockpitChip>
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso}
            max={maxIso}
            periods={["ytd", "1y", "5y", "max"]}
          />
        </>
      }
      footer={
        <>
          <strong>Leitura.</strong> {leitura} r = taxa implícita da DLSP (juros nominais 12m ÷ estoque médio); g = PIB
          nominal acumulado 12m, var. interanual. Painel nominal-nominal — o canônico p/ dinâmica de dívida (não
          confundir com a Selic real ex-post de outros cards). Perímetro único: setor público consolidado (DLSP),
          calculado SÓ no pipeline. Ressalva: a taxa implícita da DLSP embute o resultado dos swaps cambiais do BCB e o
          custo de carregamento das reservas — em meses de estresse cambial, r salta por razões que não são custo
          estrutural da dívida. Faixas cinzas: recessões CODACE/FGV (última datação: 2020).
        </>
      }
      stampGiro={geradoEm}
      stampDado={dataIso(ult.data)}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip
          label={`r (${fmtMesCurto(dataIso(ult.data))})`}
          valor={fmtPct(ult.r_aa_pct, 1)}
          hint="custo implícito, % a.a."
          cor={COR_R}
        />
        <Chip label="g (12m)" valor={fmtPct(ult.g_aa_pct, 1)} hint="PIB nominal, % a.a." cor={COR_G} />
        <Chip
          label="r − g"
          valor={`${fmtSignedNum(ult.r_menos_g_pp, 1)} p.p.`}
          hint="positivo = contra a dívida"
          cor={corGap(ult.r_menos_g_pp)}
        />
        {ult.primario_estabilizador_pct_pib != null ? (
          <Chip
            label="Primário estabilizador (SP)"
            valor={`${fmtSignedPct(ult.primario_estabilizador_pct_pib, 1)} do PIB`}
            hint="congela a dívida/PIB"
          />
        ) : null}
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

      <p className="mt-2 text-[11px]">
        <Link
          href="/painel-economico/economia/brasil/fiscal/indicadores-de-risco-fiscal#juro-inflacao-crescimento"
          className="font-semibold text-[#027DFC] hover:underline"
        >
          avaliação de risco com faixas →
        </Link>
      </p>
    </ChartCard>
  );
}
