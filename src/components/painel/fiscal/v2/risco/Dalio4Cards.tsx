"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries } from "@/components/painel/charts/AzTimeSeriesChart";
import { ChartCard } from "@/components/painel/core";
import { AzSegmented } from "@/components/painel/panorama/AzSegmented";
import type { Dalio4, IndicadorSemaforo, Nivel } from "@/lib/painel-fiscal";
import { AZ_BRAND } from "@/lib/az-chart-theme";
import { fmtNum, fmtPct, fmtSignedNum } from "@/lib/format-br";
import { RiskSeriesCard } from "./RiskSeriesCard";
import { NIVEL_RISCO, toPoints } from "./shared";

/**
 * Os 4 indicadores que Dalio prioriza em "How Countries Go Broke", como séries
 * históricas com bandas de risco — o topo da aba Indicadores de Risco Fiscal.
 *
 * 1. Dívida / Renda (toggle % Receita ↔ % PIB, referências da literatura)
 * 2. Serviço da dívida / Renda (juros nominais 12m — principal na fase 2)
 * 3. Juro nominal vs inflação e vs crescimento nominal (r × g × IPCA + gap r−g)
 * 4. Dívida e serviço da dívida vs poupança nacional (IBGE CNT)
 */

const COR_R = "#132960"; // navy — custo da dívida
const COR_G = "#027DFC"; // azure — crescimento nominal
const COR_IPCA = "#94A3B8"; // slate — inflação (benchmark tracejado)

// ─── 1. Dívida / Renda ───────────────────────────────────────────────────────
export function DividaRendaCard({
  dalio4,
  indicadorReceita,
  indicadorPib,
  stampGiro,
  stampDado,
}: {
  dalio4: Dalio4;
  indicadorReceita?: IndicadorSemaforo;
  indicadorPib?: IndicadorSemaforo;
  stampGiro?: string | null;
  stampDado?: string | null;
}) {
  const [base, setBase] = useState<"receita" | "pib">("receita");
  const dr = dalio4.divida_renda;

  // Séries vêm de indicadores_semaforo (fonte única — o dalio4 não duplica mais).
  const serieReceita = useMemo<AzTimeSeries[]>(
    () => [{ id: "divida_receita", label: "DBGG / Receita líquida 12m", color: COR_R, data: toPoints(indicadorReceita?.serie) }],
    [indicadorReceita?.serie],
  );
  const seriePib = useMemo<AzTimeSeries[]>(
    () => [{ id: "divida_pib", label: "DBGG / PIB", color: COR_R, data: toPoints(indicadorPib?.serie) }],
    [indicadorPib?.serie],
  );

  // Rótulos curtos — a margem direita do chart tem ~60px (a fonte completa
  // fica na nota metodológica do card, ícone ?). Onda 0: só o pico histórico
  // vem como linha (FMI 70% é a própria fronteira amarela; R-R não usamos).
  const refLinesPib = useMemo<AzRefLine[]>(
    () =>
      dr.referencias_pct_pib.map((r) => ({
        y: r.valor,
        label: `pico ${fmtPct(r.valor, 1)}`,
        color: AZ_BRAND.navy,
      })),
    [dr.referencias_pct_pib],
  );

  const ehReceita = base === "receita";
  const ind = ehReceita ? indicadorReceita : indicadorPib;
  const valorAtual =
    ind?.valor != null
      ? ehReceita
        ? `${fmtNum(ind.valor / 100, 1)}× a receita`
        : `${fmtPct(ind.valor, 1)} do PIB`
      : undefined;

  return (
    <RiskSeriesCard
      id="divida-renda"
      title="Dívida / Renda"
      subtitle={
        ehReceita
          ? "DBGG ÷ receita líquida 12m (gov. central) — o denominador do livro"
          : "DBGG em % do PIB — fronteiras Maastricht 60% e FMI 70% (emergentes)"
      }
      series={ehReceita ? serieReceita : seriePib}
      faixas={ehReceita ? dr.faixas_pct_receita : dr.faixas_pct_pib}
      refLines={ehReceita ? [] : refLinesPib}
      unit="%"
      nivel={ind?.nivel as Nivel | undefined}
      valorAtual={valorAtual}
      height={280}
      footer={
        <span>
          {ehReceita ? dr.faixas_pct_receita.fonte : dr.faixas_pct_pib.fonte} {dr._nota} No modo %Receita, as faixas
          são recalibradas para a proxy (conceito do livro × fator ~2,0 da razão receita geral/central — ver nota de
          calibração na ficha técnica). No modo %PIB: 60% = Maastricht, 70% = FMI p/ emergentes (fronteiras das
          bandas); pico histórico calculado da própria série. O limiar de 90% de Reinhart-Rogoff não é usado
          (contestado em Herndon et al., 2013).
        </span>
      }
      stampGiro={stampGiro}
      stampDado={stampDado}
      toolbarExtra={
        <AzSegmented
          size="sm"
          ariaLabel="Base do indicador Dívida / Renda"
          value={base}
          onChange={(id) => setBase(id as "receita" | "pib")}
          options={[
            { id: "receita", label: "% Receita" },
            { id: "pib", label: "% PIB" },
          ]}
        />
      }
    />
  );
}

// ─── 3. Juro nominal vs inflação e crescimento ───────────────────────────────
export function JurosInflacaoCrescimentoCard({
  dalio4,
  indicadorGap,
  stampGiro,
  stampDado,
}: {
  dalio4: Dalio4;
  indicadorGap?: IndicadorSemaforo;
  stampGiro?: string | null;
  stampDado?: string | null;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const bloco = dalio4.juros_inflacao_crescimento;

  const { linhas, benchmarks, gapSerie, minIso, maxIso } = useMemo(() => {
    const r: AzTimeSeries = { id: "r", label: "r — custo implícito da dívida (a.a.)", color: COR_R, data: [] as [string, number][] };
    const g: AzTimeSeries = { id: "g", label: "g — crescimento nominal 12m", color: COR_G, data: [] as [string, number][] };
    const ipca: AzTimeSeries = { id: "ipca", label: "IPCA 12m", color: COR_IPCA, data: [] as [string, number][] };
    const gap: AzTimeSeries = { id: "gap", label: "r − g", color: COR_R, data: [] as [string, number][] };
    for (const p of bloco.serie) {
      const iso = p.data.length === 7 ? `${p.data}-01` : p.data;
      (r.data as [string, number][]).push([iso, p.r_aa_pct]);
      (g.data as [string, number][]).push([iso, p.g_aa_pct]);
      if (p.ipca_12m_pct != null) (ipca.data as [string, number][]).push([iso, p.ipca_12m_pct]);
      (gap.data as [string, number][]).push([iso, p.r_menos_g_pp]);
    }
    const min = r.data[0]?.[0] ?? "";
    const max = r.data[r.data.length - 1]?.[0] ?? "";
    return { linhas: [r, g], benchmarks: [ipca], gapSerie: [gap], minIso: min, maxIso: max };
  }, [bloco.serie]);

  const gapAtual = bloco.serie.length > 0 ? bloco.serie[bloco.serie.length - 1].r_menos_g_pp : null;

  return (
    <ChartCard
      id="juro-inflacao-crescimento"
      title="Juro nominal vs inflação e crescimento"
      subtitle="r implícita (DLSP) × g nominal 12m × IPCA 12m — % a.a."
      footer={
        <span>
          {bloco._nota ?? ""} Faixas do gap: {bloco.faixas_gap.fonte} Leitura: r &gt; g = a dívida cresce mesmo com
          primário neutro (Domar); r − IPCA = aperto real.
        </span>
      }
      stampGiro={stampGiro}
      stampDado={stampDado ?? (maxIso ? maxIso.slice(0, 7) : null)}
      toolbar={
        <>
          {indicadorGap?.valor != null ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${NIVEL_RISCO[indicadorGap.nivel].chip}`}
            >
              r − g hoje: {gapAtual != null ? `${fmtSignedNum(gapAtual, 1)} pp` : "—"}
            </span>
          ) : null}
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso || undefined} max={maxIso || undefined} periods={["ytd", "1y", "5y", "max"]} />
        </>
      }
    >
      <AzTimeSeriesChart
        series={linhas}
        benchmarks={benchmarks}
        unit="%"
        period={period}
        height={250}
        yAxisLabel="% a.a."
        seriesEndLabels
      />
      <p className="mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Gap r − g (pp)</p>
      <AzTimeSeriesChart
        series={gapSerie}
        unit="none"
        period={period}
        height={110}
        showLegend={false}
        yAxisLabel="pp"
      />
      <Link
        href="/painel-economico/economia/brasil/fiscal/divida"
        className="mt-2 inline-block text-[11px] font-semibold text-[#027DFC] hover:underline"
      >
        dinâmica e decomposição na aba Dívida →
      </Link>
    </ChartCard>
  );
}

// ─── 4. Dívida e serviço vs poupança ─────────────────────────────────────────
export function PoupancaCard({
  dalio4,
  stampGiro,
  stampDado,
}: {
  dalio4: Dalio4;
  stampGiro?: string | null;
  stampDado?: string | null;
}) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const bloco = dalio4.divida_servico_poupanca;

  const { divida, juros, minIso, maxIso, ult } = useMemo(() => {
    const d: [string, number][] = [];
    const j: [string, number][] = [];
    for (const p of bloco.serie) {
      const iso = p.data.length === 7 ? `${p.data}-01` : p.data;
      if (p.divida_anos_poupanca != null) d.push([iso, p.divida_anos_poupanca]);
      if (p.juros_pct_poupanca != null) j.push([iso, p.juros_pct_poupanca]);
    }
    return {
      divida: [{ id: "divida_poup", label: "DBGG em anos de poupança nacional", color: COR_R, data: d }] as AzTimeSeries[],
      juros: [{ id: "juros_poup", label: "Juros do governo como % da poupança", color: COR_R, data: j }] as AzTimeSeries[],
      minIso: d[0]?.[0] ?? j[0]?.[0] ?? "",
      maxIso: d[d.length - 1]?.[0] ?? "",
      ult: bloco.serie[bloco.serie.length - 1] ?? null,
    };
  }, [bloco.serie]);

  return (
    <ChartCard
      id="divida-servico-poupanca"
      title="Dívida e serviço / Poupança"
      subtitle="DBGG e juros nominais 12m ÷ poupança bruta 4T (IBGE CNT, trimestral)"
      footer={<span>{bloco._nota}</span>}
      stampGiro={stampGiro}
      stampDado={stampDado ?? (ult ? ult.data.slice(0, 7) : null)}
      toolbar={
        <>
          {ult?.juros_pct_poupanca != null ? (
            <span className="inline-flex items-center rounded-full border border-[#132960]/20 bg-[#132960]/5 px-2.5 py-1 text-[11px] font-bold text-[#132960]">
              juros consomem {fmtPct(ult.juros_pct_poupanca, 0)} da poupança
            </span>
          ) : null}
          <AzPeriodSelector value={period} onChange={setPeriod} min={minIso || undefined} max={maxIso || undefined} periods={["ytd", "1y", "5y", "max"]} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Estoque — anos de poupança (×)</p>
          <AzTimeSeriesChart series={divida} unit="none" period={period} height={200} showLegend={false} yAxisLabel="×" variant="hero" />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fluxo — juros ÷ poupança (%)</p>
          <AzTimeSeriesChart series={juros} unit="%" period={period} height={200} showLegend={false} yAxisLabel="%" variant="hero" />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Poupança bruta 4T{ult ? `: ${fmtPct(ult.taxa_poupanca_pct_pib, 1)} do PIB (${ult.data})` : ""}.
      </p>
    </ChartCard>
  );
}
