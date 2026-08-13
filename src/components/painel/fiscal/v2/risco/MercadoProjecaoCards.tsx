"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, type AzPeriodValue } from "@/components/painel/charts/AzPeriodSelector";
import { AzTimeSeriesChart, type AzRefLine, type AzTimeSeries, type AzXRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import { ChartCard } from "@/components/painel/core";
import type { EmbiBlock, ProjecaoDbgg, SpreadSoberano } from "@/lib/painel-fiscal";
import { fmtNum } from "@/lib/format-br";
import { CockpitChip } from "../divida/shared";
import { toPoints } from "./shared";

/**
 * Os cards de contexto de mercado da aba de risco:
 * - Spread soberano VIVO (Onda 3) — o sucessor do EMBI+; proxy declarada na
 *   _nota do bloco, com mediana e banda p25–p75 dos últimos 10 anos.
 * - EMBI+ — o preço que o mercado COBRAVA do risco Brasil (fonte pública
 *   descontinuada em 2024; o card diz isso com todas as letras).
 * - Projeção da DBGG com Focus — conecta o framework do livro à expectativa
 *   concreta do mercado brasileiro (ilustrativa, sem efeito câmbio).
 */

const NAVY = "#132960";
const AZURE = "#027DFC";
const RUST = "#BE3B33";

// Marcos institucionais datados (rótulo com ano — fatos históricos, não dado vivo).
const MARCOS_EMBI: AzXRefArea[] = [
  { x1: "2015-09-01", x2: "2015-11-01", label: "perda do grau de investimento", color: "#BE3B33", opacity: 0.1 },
  { x1: "2016-12-01", x2: "2017-02-01", label: "teto de gastos", color: "#132960", opacity: 0.1 },
  { x1: "2023-08-01", x2: "2023-10-01", label: "arcabouço fiscal", color: "#1E8A5C", opacity: 0.12 },
];

export function SpreadSoberanoCard({ spread, stampGiro }: { spread: SpreadSoberano; stampGiro?: string | null }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { serie, minIso, maxIso } = useMemo(() => {
    const pts = toPoints(spread.serie);
    return {
      serie: [{ id: "spread_soberano", label: "Spread soberano (p.p.)", color: NAVY, data: pts }] as AzTimeSeries[],
      minIso: pts[0]?.[0] ?? "",
      maxIso: pts[pts.length - 1]?.[0] ?? "",
    };
  }, [spread.serie]);

  const p = spread.percentis_10a;
  const refAreas =
    p.p25 != null && p.p75 != null
      ? [{ y1: p.p25, y2: p.p75, color: AZURE, opacity: 0.07, label: "p25–p75 (últimos 10 anos)" }]
      : [];
  const refLines: AzRefLine[] =
    p.p50 != null ? [{ y: p.p50, label: `mediana 10a: ${fmtNum(p.p50, 1)} p.p.`, color: AZURE }] : [];

  // Posição do último valor contra a banda p25–p75 — verificada no dado, nunca afirmada.
  const ult = spread.ultimo;
  const posicao =
    ult?.valor == null || p.p25 == null || p.p75 == null
      ? null
      : ult.valor > p.p75
        ? "acima do p75"
        : ult.valor < p.p25
          ? "abaixo do p25"
          : "dentro de p25–p75";

  return (
    <ChartCard
      title="Spread soberano — vivo"
      subtitle={`${spread._fonte} · média mensal · ${spread.unidade}`}
      footer={
        <span>
          {spread._nota} O spread é o validador externo do semáforo: divergência entre o preço de mercado e o
          diagnóstico dos indicadores é informação. Mediana e banda p25–p75 calculadas nos últimos 10 anos da série.
        </span>
      }
      stampGiro={stampGiro}
      stampDado={ult?.data ?? (maxIso || null)}
      toolbar={
        <>
          {ult?.valor != null ? (
            <CockpitChip cor={posicao === "acima do p75" ? RUST : NAVY}>
              {fmtNum(ult.valor, 1)} p.p.{posicao ? ` · ${posicao}` : ""}
            </CockpitChip>
          ) : null}
          <AzPeriodSelector
            value={period}
            onChange={setPeriod}
            min={minIso || undefined}
            max={maxIso || undefined}
            periods={["ytd", "1y", "5y", "max"]}
          />
        </>
      }
    >
      <AzTimeSeriesChart
        series={serie}
        unit="none"
        period={period}
        height={280}
        refAreas={refAreas}
        refLines={refLines}
        showLegend={false}
        yAxisLabel="p.p."
      />
    </ChartCard>
  );
}

export function EmbiCard({ embi, stampGiro }: { embi: EmbiBlock; stampGiro?: string | null }) {
  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });

  const { serie, minIso, maxIso } = useMemo(() => {
    const pts = toPoints(embi.serie);
    return {
      serie: [{ id: "embi", label: "EMBI+ Brasil (pontos-base)", color: NAVY, data: pts }] as AzTimeSeries[],
      minIso: pts[0]?.[0] ?? "",
      maxIso: pts[pts.length - 1]?.[0] ?? "",
    };
  }, [embi.serie]);

  const p = embi.percentis_10a;
  const refAreas =
    p.p25 != null && p.p75 != null
      ? [{ y1: p.p25, y2: p.p75, color: AZURE, opacity: 0.07, label: "p25–p75 (últimos 10 anos da série)" }]
      : [];
  const refLines: AzRefLine[] =
    p.p50 != null ? [{ y: p.p50, label: `mediana 10a: ${p.p50.toFixed(0)} bps`, color: AZURE }] : [];

  const fimSerie = embi.ultimo?.data ?? "—";

  return (
    <ChartCard
      title="EMBI+ Brasil — spread soberano"
      subtitle="IPEADATA/JPM · média mensal · pontos-base"
      footer={
        <span>
          {embi._fonte} O spread soberano é o validador externo do semáforo: divergência entre preço de mercado e
          diagnóstico é informação.
        </span>
      }
      stampGiro={stampGiro}
      stampDado={fimSerie}
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={minIso || undefined}
          max={maxIso || undefined}
          periods={["ytd", "1y", "5y", "max"]}
        />
      }
    >
      {embi.descontinuada ? (
        <div className="mb-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Série encerrada na fonte pública em {fimSerie}.</strong> O J.P. Morgan deixou de divulgar o EMBI+
          abertamente e o CDS de 5 anos (a referência atual de research) não tem fonte gratuita. O histórico continua
          valioso: mostra como o mercado precificou 2002, 2008 e 2015–16.
        </div>
      ) : null}
      <AzTimeSeriesChart
        series={serie}
        unit="pts"
        period={period}
        height={280}
        refAreas={refAreas}
        refLines={refLines}
        xRefAreas={MARCOS_EMBI}
        showLegend={false}
        yAxisLabel="pontos-base"
      />
    </ChartCard>
  );
}

export function ProjecaoDbggCard({ projecao, stampGiro }: { projecao: ProjecaoDbgg; stampGiro?: string | null }) {
  const { hist, cenMeta, cenAtual, minIso, maxIso, anosExtrapolados } = useMemo(() => {
    const h = toPoints(projecao.historico_anual);
    const ultimo = h[h.length - 1];
    // Cenários ancorados no último ponto observado para as linhas conectarem.
    const meta: (readonly [string, number])[] = ultimo ? [ultimo] : [];
    const atual: (readonly [string, number])[] = ultimo ? [ultimo] : [];
    for (const a of projecao.anos) {
      // Ano parcial (fracao_ano 0–1): o ponto entra na linha na altura do ano
      // já decorrida, em vez de fingir dezembro cheio.
      const mes =
        a.fracao_ano != null
          ? String(Math.min(12, Math.max(1, Math.round(a.fracao_ano * 12)))).padStart(2, "0")
          : "12";
      meta.push([`${a.ano}-${mes}-01`, a.dbgg_cenario_meta_pct_pib]);
      atual.push([`${a.ano}-${mes}-01`, a.dbgg_cenario_primario_atual_pct_pib]);
    }
    return {
      hist: [{ id: "dbgg_hist", label: "DBGG observada (dez. de cada ano)", color: NAVY, data: h }] as AzTimeSeries[],
      cenMeta: { id: "cen_meta", label: "cenário: metas LDO cumpridas", color: AZURE, data: meta } as AzTimeSeries,
      cenAtual: { id: "cen_atual", label: "cenário: primário atual constante", color: RUST, data: atual } as AzTimeSeries,
      minIso: h[0]?.[0] ?? "",
      maxIso: atual[atual.length - 1]?.[0] ?? "",
      anosExtrapolados: projecao.anos.filter((a) => a.meta_extrapolada).map((a) => a.ano),
    };
  }, [projecao]);

  const [period, setPeriod] = useState<AzPeriodValue>({ id: "max" });
  const ultimoAno = projecao.anos[projecao.anos.length - 1];

  return (
    <ChartCard
      title="DBGG projetada — cenários com Focus"
      subtitle={`b(t+1) = (b(t)·(1+i) − primário) / (1+g) · medianas do Focus até ${ultimoAno?.ano ?? "—"}`}
      footer={
        <span>
          {projecao._nota} Premissas atuais: i = {fmtNum(projecao.premissas.i_aa_pct)}% a.a.; primário 12m ={" "}
          {fmtNum(projecao.premissas.primario_atual_pct_pib)}% do PIB. A distância entre os dois cenários é o custo de
          não cumprir a meta.
        </span>
      }
      stampGiro={stampGiro}
      toolbar={
        <AzPeriodSelector
          value={period}
          onChange={setPeriod}
          min={minIso || undefined}
          max={maxIso || undefined}
          periods={["ytd", "1y", "5y", "max"]}
        />
      }
    >
      <AzTimeSeriesChart
        series={hist}
        benchmarks={[cenMeta, cenAtual]}
        unit="%"
        period={period}
        height={280}
        dots={2.5}
        yAxisLabel="% do PIB"
        refLines={[{ y: 70, label: "FMI 70%", color: NAVY }]}
      />
      {anosExtrapolados.length > 0 ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          {anosExtrapolados.length === 1
            ? `${anosExtrapolados[0]}: meta extrapolada (hipótese AZ)`
            : `${anosExtrapolados[0]}–${anosExtrapolados[anosExtrapolados.length - 1]}: meta extrapolada (hipótese AZ)`}{" "}
          — além do horizonte legal da LDO.
        </p>
      ) : null}
    </ChartCard>
  );
}
