"use client";

import { useMemo, useState } from "react";
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

import type { AtividadeCodaceData, AtividadePibData, CodaceFaixaAtividade } from "@/lib/painel-atividade";
import {
  AzTooltip,
  ChartCard,
  CockpitChip,
  azGridProps,
  azXAxisProps,
  azYAxisProps,
  azZeroLineProps,
  tomPorSinal,
} from "@/components/painel/core";
import { AzPeriodSelector, resolvePeriodRange, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AZ_BRAND, AZ_CHART, AZ_TOOLTIP_PROPS, variationFill } from "@/lib/az-chart-theme";
import { fmtSignedNum, fmtSignedPct } from "@/lib/format-br";
import { fmtTrimCurto, num, trimIsoCentral } from "../../shared";
import { estatisticasBanda } from "../cockpit-shared";

/**
 * COCKPIT PIB — ritmo trimestral (QoQ SA) em barras: variação real do PIB vs
 * trimestre anterior, com ajuste sazonal (SIDRA 5932 v6564, `qoq_sa_pib`).
 * Régua histórica sem juízo de valor: banda p25–p75 + mediana dos últimos 40
 * trimestres (mediana, não média — robusta a 2020). Recessões CODACE/FGV ao
 * fundo. Adaptação do painel de barras de RitmoTrimestralCard (v2) à casca §10.
 */

const JANELA_BANDA = 40;
const CAMPO = "qoq_sa_pib";

/**
 * Converte faixas CODACE trimestrais ("2014-Q1") nos keys de trim visíveis,
 * clipando à janela. Cópia de AnchorContribuicoesPib.tsx (a função não é
 * exportada lá e o contrato proíbe editar outros arquivos).
 */
function codaceTrims(faixas: ReadonlyArray<CodaceFaixaAtividade> | undefined, trims: string[]): { x1: string; x2: string }[] {
  if (!faixas || trims.length === 0) return [];
  const out: { x1: string; x2: string }[] = [];
  for (const f of faixas) {
    if (f.tipo !== "recessao") continue;
    const pico = f.pico.replace(/-Q(\d)$/, (_, q) => `-T0${q}`);
    const vale = f.vale.replace(/-Q(\d)$/, (_, q) => `-T0${q}`);
    if (vale < trims[0] || pico > trims[trims.length - 1]) continue;
    const x1 = trims.find((t) => t >= pico) ?? trims[0];
    const x2 = [...trims].reverse().find((t) => t <= vale) ?? trims[trims.length - 1];
    if (x1 <= x2) out.push({ x1, x2 });
  }
  return out;
}

type LinhaQoq = { trim: string; qoq: number };

/** Tick do eixo Y: inteiro sem casa ("+2%"), fracionário com uma ("+0,5%"). */
function fmtTickY(v: number): string {
  return fmtSignedPct(v, Number.isInteger(v) ? 0 : 1);
}

export function RitmoQoqCard({
  pib,
  codace,
  geradoEm,
}: {
  pib: AtividadePibData;
  codace?: AtividadeCodaceData | null;
  geradoEm: string;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "10y" });

  const serie = pib.variacao.serie;

  // Só observações com QoQ SA não-nulo (o PIB sempre tem; é `qoq_sa_impostos` que a 5932 não publica).
  const todas = useMemo<LinhaQoq[]>(() => {
    const out: LinhaQoq[] = [];
    for (const r of serie) {
      const v = num(r, CAMPO);
      if (v != null) out.push({ trim: r.trim, qoq: v });
    }
    return out;
  }, [serie]);

  const minIso = todas.length > 0 ? trimIsoCentral(todas[0].trim) : "";
  const maxIso = todas.length > 0 ? trimIsoCentral(todas[todas.length - 1].trim) : "";

  const rows = useMemo<LinhaQoq[]>(() => {
    if (todas.length === 0) return [];
    const { from, to } = resolvePeriodRange(period, minIso, maxIso);
    return todas.filter((r) => {
      const iso = trimIsoCentral(r.trim);
      return iso >= from && iso <= to;
    });
  }, [todas, period, minIso, maxIso]);

  // Banda histórica: p25–p75 + mediana dos ÚLTIMOS 40 trimestres com dado (fixa, independe da janela).
  const banda = useMemo(() => estatisticasBanda(todas.slice(-JANELA_BANDA).map((r) => r.qoq)), [todas]);

  // Extremos de TODA a série gravada (lidos do dado, nunca hardcoded).
  const extremos = useMemo(() => {
    if (todas.length === 0) return null;
    let min = todas[0];
    let max = todas[0];
    for (const r of todas) {
      if (r.qoq < min.qoq) min = r;
      if (r.qoq > max.qoq) max = r;
    }
    return { min, max };
  }, [todas]);

  const ult = todas.length > 0 ? todas[todas.length - 1] : null;
  const penult = todas.length > 1 ? todas[todas.length - 2] : null;
  const delta = ult && penult ? +(ult.qoq - penult.qoq).toFixed(2) : null;

  const posicao = ult && banda ? (ult.qoq > banda.p75 ? "acima" : ult.qoq < banda.p25 ? "abaixo" : "dentro") : null;

  const trimsVisiveis = useMemo(() => rows.map((r) => r.trim), [rows]);
  const faixas = useMemo(() => codaceTrims(codace?.trimestral, trimsVisiveis), [codace, trimsVisiveis]);

  const chipTexto = ult
    ? [
        `${fmtTrimCurto(ult.trim)} · ${fmtSignedPct(ult.qoq, 1)} t/t`,
        banda && posicao
          ? `${posicao} da banda ${JANELA_BANDA}T (${fmtSignedNum(banda.p25, 1)} a ${fmtSignedNum(banda.p75, 1)})`
          : null,
        penult && delta != null ? `Δ vs ${fmtTrimCurto(penult.trim)} ${fmtSignedNum(delta, 1)} p.p.` : null,
      ]
        .filter((s): s is string => s != null)
        .join(" · ")
    : "—";

  const extremosTexto = extremos
    ? `${fmtSignedPct(extremos.min.qoq, 1)} no ${fmtTrimCurto(extremos.min.trim)} e ${fmtSignedPct(extremos.max.qoq, 1)} no ${fmtTrimCurto(extremos.max.trim)}`
    : "—";
  const bandaTexto = banda
    ? `${fmtSignedPct(banda.p25, 1)} a ${fmtSignedPct(banda.p75, 1)}, mediana ${fmtSignedPct(banda.mediana, 1)}`
    : "—";

  const footer = (
    <div className="space-y-1.5">
      <p>
        <strong>QoQ SA</strong> = variação real do PIB contra o trimestre imediatamente anterior, com ajuste sazonal
        (SIDRA 5932, variável 6564) — o número-manchete da divulgação do IBGE. Barra verde = cresceu; vermelha = caiu
        (direção literal do número, sem julgamento de bom/ruim).
      </p>
      <p>
        <strong>Banda e mediana</strong>: faixa cinza horizontal = intervalo p25–p75 e linha tracejada = mediana, ambos
        dos últimos {banda?.n ?? JANELA_BANDA} trimestres com dado ({bandaTexto}). A banda é a distribuição histórica do
        próprio ritmo: diz onde a leitura atual cai em relação ao passado recente, sem juízo de valor (metade das
        leituras ficou dentro dela, um quarto acima, um quarto abaixo). Mediana em vez de média porque a média é
        puxada pelos extremos de 2020 ({extremosTexto} — mínimo e máximo de toda a série gravada, lidos do dado).
        Banda e mediana são fixas nos últimos {JANELA_BANDA} trimestres e não mudam com a janela do seletor.
        Calculadas no cliente.
      </p>
      <p>
        <strong>Δ vs trimestre anterior</strong> = diferença, em pontos percentuais, entre o QoQ SA deste trimestre e
        o do anterior (aceleração ou desaceleração do ritmo). Faixas verticais cinzas = recessões datadas pelo
        CODACE/FGV (cronologia oficial, atualizada com defasagem). O eixo Y se adapta à janela: quando 2020 está
        visível, as barras extremas comprimem o restante — 5A mostra o ritmo recente com mais resolução.
      </p>
    </div>
  );

  return (
    <ChartCard
      id="pib-ritmo-qoq"
      title="PIB — variação trimestral SA (%)"
      subtitle="SIDRA 5932 · barras t/t−1 com ajuste sazonal · banda p25–p75 e mediana dos últimos 40 trimestres · recessões CODACE"
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={minIso || undefined}
          max={maxIso || undefined}
          periods={["5y", "10y", "max"]}
        />
      }
      footer={footer}
      stampGiro={geradoEm}
      stampDado={ult ? ult.trim : null}
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <CockpitChip
          tom={tomPorSinal(ult?.qoq)}
          title="Último QoQ SA · posição na banda p25–p75 dos últimos 40 trimestres · variação do ritmo vs trimestre anterior"
        >
          {chipTexto}
        </CockpitChip>
      </div>

      {rows.length === 0 ? (
        <p className="flex h-[240px] items-center justify-center text-sm text-zinc-400">
          — sem observações de QoQ SA do PIB na janela selecionada.
        </p>
      ) : (
        <div className="w-full">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...azGridProps()} />
              <XAxis {...azXAxisProps()} dataKey="trim" tickFormatter={fmtTrimCurto} minTickGap={28} />
              <YAxis {...azYAxisProps()} width={44} tickFormatter={fmtTickY} />

              {faixas.map((f, i) => (
                <ReferenceArea
                  key={`codace-${i}`}
                  x1={f.x1}
                  x2={f.x2}
                  fill={AZ_CHART.ticks}
                  fillOpacity={0.07}
                  stroke="none"
                />
              ))}

              {banda ? (
                <ReferenceArea
                  y1={banda.p25}
                  y2={banda.p75}
                  fill={AZ_CHART.ticks}
                  fillOpacity={0.1}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              ) : null}

              <ReferenceLine {...azZeroLineProps("y")} />

              {banda ? (
                <ReferenceLine
                  y={banda.mediana}
                  stroke={AZ_BRAND.navy}
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                  ifOverflow="extendDomain"
                  label={{
                    value: `mediana ${JANELA_BANDA}T ${fmtSignedPct(banda.mediana, 1)}`,
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: AZ_BRAND.navy,
                  }}
                />
              ) : null}

              <Tooltip
                content={
                  <AzTooltip labelFmt={(l) => fmtTrimCurto(String(l))} valueFmt={(v) => fmtSignedPct(v, 1)} hideDot />
                }
                cursor={AZ_TOOLTIP_PROPS.cursor}
              />

              <Bar dataKey="qoq" name="QoQ SA" isAnimationActive={false} maxBarSize={18} radius={[2, 2, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.trim} fill={variationFill(r.qoq)} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
