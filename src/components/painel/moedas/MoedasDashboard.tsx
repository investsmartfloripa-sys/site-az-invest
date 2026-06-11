"use client";

import { useMemo, useState } from "react";

import { AzPeriodSelector, AzTimeSeriesChart, type AzPeriodValue, type AzTimeSeries } from "@/components/painel/charts";
import { DivergingReturnBars } from "@/components/painel/charts/DivergingReturnBars";
import { AzSegmented, ChartCard, DashboardScaffold, KpiCard, RankingTable, type DashboardBloco } from "@/components/painel/core";
import { PipelinePendingCard } from "@/components/painel/PipelinePendingCard";
import { variationText } from "@/lib/az-chart-theme";
import { fmtBRL, fmtDataBR, fmtNum, fmtSignedPct } from "@/lib/format-br";
import {
  FX_PAIRS,
  FX_PERIOD_BY_PANORAMA,
  FX_SHIFT_BY_PERIOD,
  PANORAMA_PERIODS,
  fxCurrencyReturnPct,
  type FxPairDef,
  type FxTopMoversPayload,
  type HistorySlice,
  type PanoramaPeriodKey,
} from "@/lib/painel-mercado-global";

/**
 * Dashboard de Moedas (mercado · global) — absorveu a antiga página de câmbio.
 *
 * Duas camadas: leitura rápida no topo (manchete em prosa + 4 KPIs + ranking
 * "o dólar contra o mundo") e esmiuçamento abaixo (bloco BRL com hero USD/BRL
 * + cruzes + real entre os emergentes, DXY e tabela completa).
 *
 * CONVENÇÃO DE SINAL (única em toda a página): retorno exibido = retorno DA
 * MOEDA contra o USD; positivo = moeda se valorizou. Pares com USD na base
 * (USD/JPY, USD/BRL...) têm o retorno do par invertido (ver
 * fxCurrencyReturnPct em painel-mercado-global.ts). Exceção deliberada: os
 * KPIs/gráficos do bloco BRL mostram a COTAÇÃO do par (alta do USD/BRL =
 * real mais fraco) — é a leitura usual do brasileiro, sinalizada no rodapé.
 */

const DXY = "DX-Y.NYB";
const USD = "BRL=X";
const EUR_BRL = "EURBRL=X";
const GBP_BRL = "GBPBRL=X";

/** Banda de "estável" da manchete: |Δ1d do DXY| ≤ 0,15% não vira manchete de força/fraqueza. */
const DXY_HEADLINE_BAND_PCT = 0.15;

type FxRow = {
  def: FxPairDef;
  /** Cotação spot na convenção do par (USD/JPY = ienes por dólar). */
  quote: number | null;
  /** Retorno % DA MOEDA vs USD por janela (null = sem dado na janela). */
  returns: Record<PanoramaPeriodKey, number | null>;
  /** Fonte do dado: histórico diário 5a ou fallback do fx_top_movers. */
  source: "history" | "movers" | null;
};

/** Última cotação + variação 1D (%) do PAR a partir da série diária. */
function lastAndDayChange(data: Array<[string, number]> | undefined): {
  last: number | null;
  dayChangePct: number | null;
} {
  if (!data || data.length === 0) return { last: null, dayChangePct: null };
  const last = data[data.length - 1][1];
  if (data.length < 2) return { last, dayChangePct: null };
  const prev = data[data.length - 2][1];
  return { last, dayChangePct: prev > 0 ? (last / prev - 1) * 100 : null };
}

/** Cotação com casas adaptativas: 1,0842 · 17,38 · 1.378 (IDR, COP...). */
function fmtQuote(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1000) return fmtNum(v, 0);
  if (v >= 100) return fmtNum(v, 2);
  if (v >= 10) return fmtNum(v, 3);
  return fmtNum(v, 4);
}

/** Posição ordinal pt-BR ("3º"). */
function ordinal(n: number): string {
  return `${n}º`;
}

type Props = {
  movers: FxTopMoversPayload | null;
  /** Séries diárias de 5 anos: pares do FX_PAIRS + EURBRL/GBPBRL + DXY. */
  history: HistorySlice;
};

export function MoedasDashboard({ movers, history }: Props) {
  const [rankPeriod, setRankPeriod] = useState<PanoramaPeriodKey>("1d");
  const [heroPeriod, setHeroPeriod] = useState<AzPeriodValue>({ id: "5y" });
  const [cruzesPeriod, setCruzesPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [cruzesMode, setCruzesMode] = useState<"raw" | "pct">("raw");
  const [dxyPeriod, setDxyPeriod] = useState<AzPeriodValue>({ id: "1y" });
  const [emPeriod, setEmPeriod] = useState<PanoramaPeriodKey>("1mo");

  const byTicker = useMemo(() => {
    const map = new Map<string, (typeof history.series)[number]>();
    for (const s of history.series) map.set(s.ticker, s);
    return map;
  }, [history.series]);

  // ── Fallback: fx_top_movers por código de moeda ("BRL / USD" → BRL) ───────
  // Mesma convenção de sinal (change_pct = retorno da moeda vs USD) e mesmos
  // shifts de pregão (1/5/21/63/252) — fontes intercambiáveis por janela.
  const moversByCode = useMemo(() => {
    const map = new Map<string, { returns: Partial<Record<PanoramaPeriodKey, number>>; lastClose: number | null }>();
    if (!movers?.top) return map;
    for (const period of PANORAMA_PERIODS) {
      const block = movers.top[FX_PERIOD_BY_PANORAMA[period.id]];
      for (const row of [...(block?.up ?? []), ...(block?.down ?? [])]) {
        if (!row || row.ticker === "DXY" || !Number.isFinite(row.change_pct)) continue;
        const code = row.ticker.trim().slice(0, 3).toUpperCase();
        const entry = map.get(code) ?? { returns: {}, lastClose: null };
        if (entry.returns[period.id] == null) entry.returns[period.id] = row.change_pct;
        if (entry.lastClose == null && row.last_close != null && row.last_close > 0) entry.lastClose = row.last_close;
        map.set(code, entry);
      }
    }
    return map;
  }, [movers]);

  // ── Linhas do universo: histórico primeiro, movers como fallback ─────────
  const rows = useMemo<FxRow[]>(() => {
    return FX_PAIRS.map((def) => {
      const serie = byTicker.get(def.ticker)?.data;
      const fromHistory: Record<PanoramaPeriodKey, number | null> = {
        "1d": fxCurrencyReturnPct(serie, FX_SHIFT_BY_PERIOD["1d"], def.usdBase),
        "1wk": fxCurrencyReturnPct(serie, FX_SHIFT_BY_PERIOD["1wk"], def.usdBase),
        "1mo": fxCurrencyReturnPct(serie, FX_SHIFT_BY_PERIOD["1mo"], def.usdBase),
        "3mo": fxCurrencyReturnPct(serie, FX_SHIFT_BY_PERIOD["3mo"], def.usdBase),
        "1y": fxCurrencyReturnPct(serie, FX_SHIFT_BY_PERIOD["1y"], def.usdBase),
      };
      const hasHistory = Object.values(fromHistory).some((v) => v != null);
      if (hasHistory) {
        const quote = serie && serie.length > 0 ? serie[serie.length - 1][1] : null;
        return { def, quote, returns: fromHistory, source: "history" as const };
      }
      const fb = moversByCode.get(def.code);
      if (fb) {
        // last_close do movers é sempre MOEDA/USD — converte p/ a convenção do par.
        const quote = fb.lastClose == null ? null : def.usdBase ? 1 / fb.lastClose : fb.lastClose;
        return {
          def,
          quote,
          returns: {
            "1d": fb.returns["1d"] ?? null,
            "1wk": fb.returns["1wk"] ?? null,
            "1mo": fb.returns["1mo"] ?? null,
            "3mo": fb.returns["3mo"] ?? null,
            "1y": fb.returns["1y"] ?? null,
          },
          source: "movers" as const,
        };
      }
      return {
        def,
        quote: null,
        returns: { "1d": null, "1wk": null, "1mo": null, "3mo": null, "1y": null },
        source: null,
      };
    });
  }, [byTicker, moversByCode]);

  /** Pares ainda sem nenhuma fonte de dado (catálogo novo, aguardando o 1º giro). */
  const pending = useMemo(() => rows.filter((r) => r.source == null), [rows]);

  const usd = byTicker.get(USD);
  const eur = byTicker.get(EUR_BRL);
  const gbp = byTicker.get(GBP_BRL);
  const dxy = byTicker.get(DXY);

  const histMin = usd?.data[0]?.[0];
  const histMax = history.lastDataDate ?? undefined;

  // ── Leituras do DXY (1d + YTD) ────────────────────────────────────────────
  const dxyRead = useMemo(() => {
    const { last, dayChangePct } = lastAndDayChange(dxy?.data);
    let ytdPct: number | null = null;
    if (dxy && dxy.data.length > 1 && last != null) {
      const year = dxy.data[dxy.data.length - 1][0].slice(0, 4);
      const firstOfYear = dxy.data.find(([d]) => d.slice(0, 4) === year);
      if (firstOfYear && firstOfYear[1] > 0) ytdPct = (last / firstOfYear[1] - 1) * 100;
    }
    return { last, dayChangePct, ytdPct };
  }, [dxy]);

  // ── Melhor/pior do dia + posição do real entre os emergentes ─────────────
  const dayStats = useMemo(() => {
    const withDay = rows.filter((r) => r.returns["1d"] != null) as Array<FxRow & { returns: { "1d": number } }>;
    const sorted = [...withDay].sort((a, b) => b.returns["1d"] - a.returns["1d"]);
    const best = sorted[0] ?? null;
    const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    const em = sorted.filter((r) => r.def.group === "emergentes");
    const brlIdx = em.findIndex((r) => r.def.code === "BRL");
    return {
      best,
      worst,
      emCount: em.length,
      brlRank: brlIdx >= 0 ? brlIdx + 1 : null,
      brlDay: brlIdx >= 0 ? em[brlIdx].returns["1d"] : null,
    };
  }, [rows]);

  // ── Manchete em prosa, gerada por regra ───────────────────────────────────
  // Regras: (1) força do dólar global pelo Δ1d do DXY com banda de ±0,15%;
  // (2) melhor e pior moeda do dia no universo coberto; (3) posição do real
  // no ranking 1d dos emergentes. Frases somem quando falta o insumo.
  const manchete = useMemo(() => {
    const partes: string[] = [];
    if (dxyRead.last != null && dxyRead.dayChangePct != null) {
      const tone =
        Math.abs(dxyRead.dayChangePct) <= DXY_HEADLINE_BAND_PCT
          ? "praticamente estável"
          : dxyRead.dayChangePct > 0
            ? "mais forte"
            : "mais fraco";
      partes.push(
        `O dólar global está ${tone} hoje: o DXY marca ${fmtNum(dxyRead.last, 1)} pts (${fmtSignedPct(dxyRead.dayChangePct, 2)} no dia)`,
      );
    }
    if (dayStats.best && dayStats.worst && dayStats.best !== dayStats.worst) {
      partes.push(
        `a melhor moeda do dia contra o dólar é o ${dayStats.best.def.name.toLowerCase()} (${fmtSignedPct(dayStats.best.returns["1d"], 2)}) e a pior, o ${dayStats.worst.def.name.toLowerCase()} (${fmtSignedPct(dayStats.worst.returns["1d"], 2)})`,
      );
    }
    if (dayStats.brlRank != null && dayStats.brlDay != null && dayStats.emCount > 1) {
      partes.push(
        `o real ${dayStats.brlDay >= 0 ? "se valoriza" : "se desvaloriza"} ${fmtSignedPct(dayStats.brlDay, 2)} e aparece em ${ordinal(dayStats.brlRank)} entre ${dayStats.emCount} moedas emergentes no dia`,
      );
    }
    return partes.length > 0 ? `${partes.join("; ")}.` : null;
  }, [dxyRead, dayStats]);

  // ── KPIs (máx. 4) ─────────────────────────────────────────────────────────
  const usdKpi = lastAndDayChange(usd?.data);
  const kpis = [
    <KpiCard
      key="usdbrl"
      label="Dólar (USD/BRL)"
      value={usdKpi.last != null ? fmtBRL(usdKpi.last) : "—"}
      delta={usdKpi.dayChangePct}
      deltaHint="1D (cotação do par)"
    />,
    <KpiCard
      key="dxy"
      label="DXY (índice do dólar)"
      value={dxyRead.last != null ? fmtNum(dxyRead.last, 1) : "—"}
      unit="pts"
      delta={dxyRead.dayChangePct}
      deltaHint="1D"
    />,
    <KpiCard
      key="best"
      label="Melhor moeda do dia"
      value={dayStats.best ? dayStats.best.def.code : "—"}
      delta={dayStats.best?.returns["1d"] ?? null}
      deltaHint="vs USD"
      hint={dayStats.best?.def.name}
    />,
    <KpiCard
      key="worst"
      label="Pior moeda do dia"
      value={dayStats.worst ? dayStats.worst.def.code : "—"}
      delta={dayStats.worst?.returns["1d"] ?? null}
      deltaHint="vs USD"
      hint={dayStats.worst?.def.name}
    />,
  ];

  // ── Âncora: ranking divergente Majors × Emergentes ────────────────────────
  const rankRows = useMemo(() => {
    const build = (group: FxPairDef["group"]) =>
      rows
        .filter((r) => r.def.group === group && r.returns[rankPeriod] != null)
        .map((r) => ({ label: r.def.name, value: r.returns[rankPeriod] as number }))
        .sort((a, b) => b.value - a.value);
    return { majors: build("majors"), emergentes: build("emergentes") };
  }, [rows, rankPeriod]);

  const anchor = (
    <ChartCard
      title="O dólar contra o mundo"
      subtitle="Variação de cada moeda CONTRA o dólar na janela — positivo = a moeda se fortaleceu"
      toolbar={
        <AzSegmented
          ariaLabel="Janela do ranking"
          value={rankPeriod}
          onChange={(v) => setRankPeriod(v as PanoramaPeriodKey)}
          options={PANORAMA_PERIODS}
        />
      }
      footer={
        <>
          Convenção de sinal: o retorno é sempre o da MOEDA contra o USD — em pares cotados com o
          dólar na base (USD/JPY, USD/BRL...), o retorno do par é invertido antes de exibir.
          Calculado sobre fechamentos diários (Yahoo Finance), janelas de 1/5/21/63/252 pregões.
          {pending.length > 0 ? (
            <>
              {" "}
              Histórico em construção (entram no próximo giro do market-data):{" "}
              {pending.map((p) => p.def.name).join(", ")}.
            </>
          ) : null}
        </>
      }
      stampGiro={history.generatedAt ?? movers?.generated_at}
      stampDado={history.lastDataDate ?? movers?.top?.day?.asof}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
            Majors (G10 + nórdicas)
          </h3>
          <DivergingReturnBars rows={rankRows.majors} yAxisWidth={132} />
        </div>
        <div>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
            Emergentes (o real entre elas)
          </h3>
          <DivergingReturnBars rows={rankRows.emergentes} yAxisWidth={132} />
        </div>
      </div>
    </ChartCard>
  );

  // ── Bloco BRL — séries ────────────────────────────────────────────────────
  const heroSeries = useMemo<AzTimeSeries[]>(
    () => (usd ? [{ id: USD, label: "USD/BRL", data: usd.data }] : []),
    [usd],
  );

  const cruzesSeries = useMemo<AzTimeSeries[]>(
    () =>
      [
        usd ? { id: USD, label: "USD/BRL", data: usd.data } : null,
        eur ? { id: EUR_BRL, label: "EUR/BRL", color: "#7C3AED", data: eur.data } : null,
        gbp ? { id: GBP_BRL, label: "GBP/BRL", color: "#A16207", data: gbp.data } : null,
      ].filter((s): s is NonNullable<typeof s> => s != null),
    [usd, eur, gbp],
  );

  const dxySeries = useMemo<AzTimeSeries[]>(
    () => (dxy ? [{ id: "dxy", label: "DXY", color: "#132960", data: dxy.data }] : []),
    [dxy],
  );

  // Ranking EM com o real destacado (janela própria, default 1M).
  const emRanking = useMemo(() => {
    const emRows = rows
      .filter((r) => r.def.group === "emergentes" && r.returns[emPeriod] != null)
      .map((r) => ({ code: r.def.code, name: r.def.name, value: r.returns[emPeriod] as number }))
      .sort((a, b) => b.value - a.value);
    const brlIdx = emRows.findIndex((r) => r.code === "BRL");
    return { emRows, brlRank: brlIdx >= 0 ? brlIdx + 1 : null };
  }, [rows, emPeriod]);

  const blocoBrl = (
    <div className="space-y-6">
      {usd ? (
        <ChartCard
          title="Dólar — USD/BRL"
          subtitle="Fechamento diário dos últimos 5 anos"
          footer={
            <>
              Cotação spot de fechamento (Yahoo Finance), 1x/dia útil. Alta do par = real mais
              fraco — leitura em cotação, não na convenção moeda-vs-USD do ranking acima.
            </>
          }
          stampGiro={history.generatedAt}
          stampDado={history.lastDataDate}
        >
          <div className="space-y-3">
            <AzPeriodSelector value={heroPeriod} onChange={setHeroPeriod} min={histMin} max={histMax} />
            <AzTimeSeriesChart series={heroSeries} unit="R$" period={heroPeriod} height={320} variant="hero" />
          </div>
        </ChartCard>
      ) : (
        <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
      )}

      {cruzesSeries.length > 0 ? (
        <ChartCard
          title="Cruzes do real"
          subtitle="USD/BRL, EUR/BRL e GBP/BRL — quanto custa cada moeda em reais"
          toolbar={
            <AzSegmented
              ariaLabel="Modo de leitura"
              value={cruzesMode}
              onChange={(v) => setCruzesMode(v as "raw" | "pct")}
              options={[
                { id: "raw", label: "Cotação (R$)" },
                { id: "pct", label: "Variação %" },
              ]}
            />
          }
          footer={
            <>
              Em &quot;Variação %&quot;, cada série acumula a variação desde o primeiro pregão da
              janela — alta = real mais fraco contra a moeda.
            </>
          }
          stampGiro={history.generatedAt}
          stampDado={history.lastDataDate}
        >
          <div className="space-y-3">
            <AzPeriodSelector value={cruzesPeriod} onChange={setCruzesPeriod} min={histMin} max={histMax} />
            <AzTimeSeriesChart
              series={cruzesSeries}
              unit="R$"
              mode={cruzesMode === "pct" ? "pct_acum" : "raw"}
              period={cruzesPeriod}
              height={320}
              forwardFill
            />
          </div>
        </ChartCard>
      ) : null}

      <ChartCard
        title="O real entre os emergentes"
        subtitle={
          emRanking.brlRank != null
            ? `Na janela escolhida, o real é o ${ordinal(emRanking.brlRank)} de ${emRanking.emRows.length} moedas emergentes contra o dólar`
            : "Ranking das moedas emergentes contra o dólar na janela escolhida"
        }
        toolbar={
          <AzSegmented
            ariaLabel="Janela do ranking emergente"
            value={emPeriod}
            onChange={(v) => setEmPeriod(v as PanoramaPeriodKey)}
            options={PANORAMA_PERIODS}
          />
        }
        footer={<>Positivo = moeda valorizou contra o USD (mesma convenção do ranking principal).</>}
        stampGiro={history.generatedAt ?? movers?.generated_at}
        stampDado={history.lastDataDate ?? movers?.top?.day?.asof}
      >
        <RankingTable
          title="Emergentes vs USD"
          rows={emRanking.emRows.map((r) => ({
            label: r.name,
            hint: r.code === "BRL" ? "BRL · Brasil" : r.code,
            value: r.value,
          }))}
        />
      </ChartCard>
    </div>
  );

  // ── Bloco DXY ─────────────────────────────────────────────────────────────
  const blocoDxy = dxy ? (
    <ChartCard
      title="DXY — índice do dólar"
      subtitle="Força do USD contra a cesta de moedas desenvolvidas (EUR, JPY, GBP, CAD, SEK, CHF)"
      footer={<>Alta do DXY = dólar globalmente mais forte; pressão típica de alta no USD/BRL. Não inclui moedas emergentes.</>}
      stampGiro={history.generatedAt}
      stampDado={history.lastDataDate}
    >
      <div className="space-y-3">
        {dxyRead.last != null ? (
          <p className="text-sm text-zinc-700">
            Dólar global no nível <strong>{fmtNum(dxyRead.last, 1)} pts</strong>
            {dxyRead.ytdPct != null ? (
              <>
                , <strong style={{ color: variationText(dxyRead.ytdPct) }}>{fmtSignedPct(dxyRead.ytdPct, 1)}</strong> no
                ano
              </>
            ) : null}
            {dxyRead.dayChangePct != null ? <> e {fmtSignedPct(dxyRead.dayChangePct, 2)} no dia.</> : "."}
          </p>
        ) : null}
        <AzPeriodSelector
          value={dxyPeriod}
          onChange={setDxyPeriod}
          min={dxy.data[0]?.[0]}
          max={histMax}
          periods={["3m", "6m", "ytd", "1y", "5y", "max"]}
        />
        <AzTimeSeriesChart series={dxySeries} unit="index" period={dxyPeriod} height={300} />
      </div>
    </ChartCard>
  ) : (
    <PipelinePendingCard blobPaths={["data/market_history_full.json"]} workflow="market-data.yml" />
  );

  // ── Esmiuçamento: tabela completa colapsável ──────────────────────────────
  const tabela = (
    <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm" open>
      <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
        Tabela completa — {rows.length} moedas, cotação e 5 janelas
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#132960]/15 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-2 font-semibold">Moeda</th>
              <th className="py-2 pr-2 font-semibold">Par</th>
              <th className="py-2 pr-2 text-right font-semibold">Cotação</th>
              {PANORAMA_PERIODS.map((p) => (
                <th key={p.id} className="py-2 pl-2 text-right font-semibold">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["majors", "emergentes"] as const).map((group) => (
              <SectionRows key={group} group={group} rows={rows} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Retornos da MOEDA contra o USD (positivo = moeda valorizou); a cotação segue a convenção do
        par. Linhas com &quot;—&quot; em todas as janelas são pares recém-adicionados ao catálogo —
        histórico em construção, série completa no próximo giro do market-data.
      </p>
    </details>
  );

  // ── Scaffold ──────────────────────────────────────────────────────────────
  const blocos: DashboardBloco[] = [
    {
      id: "bloco-brl",
      eyebrow: "Bloco BRL",
      titulo: "O real em foco",
      descricao: "O que era a página de câmbio: USD/BRL em 5 anos, cruzes do real e o real no peer group emergente.",
      children: blocoBrl,
    },
    {
      id: "dxy",
      eyebrow: "Dólar global",
      titulo: "DXY — o termômetro do dólar",
      descricao: "O índice que arbitra a dúvida: o movimento é fraqueza do real ou força global do dólar?",
      children: blocoDxy,
    },
    {
      id: "esmiucamento",
      eyebrow: "Esmiuçamento",
      titulo: "Todas as moedas",
      descricao: "Cotação e retornos vs USD em 5 janelas, por bloco — para quem quer a planilha inteira.",
      children: tabela,
    },
  ];

  return (
    <DashboardScaffold
      header={{
        titulo: "Moedas — o dólar contra o mundo",
        subtitulo:
          "Moedas desenvolvidas e emergentes contra o USD, com o bloco do real em destaque. Leitura rápida no topo, esmiuçamento abaixo.",
        referencia: history.lastDataDate ? `Dado mais recente: ${fmtDataBR(history.lastDataDate)}` : undefined,
      }}
      manchete={manchete}
      kpis={kpis}
      anchor={anchor}
      blocos={blocos}
      fichaTecnica={
        <div className="space-y-2">
          <p>
            <strong>Fontes.</strong> Séries diárias de 5 anos do Yahoo Finance via pipeline AZ
            (market-data.yml, 1x/dia útil, <code>data/market_history_full.json</code>) e top movers
            intradiários (<code>data/fx_top_movers.json</code>, giro de 15 min) usados como fallback
            enquanto um par novo ainda não tem série histórica. Cotações spot de fechamento — não é
            a PTAX do BCB, que fecha em horário próprio.
          </p>
          <p>
            <strong>Convenção de sinal.</strong> Todo retorno é o da moeda CONTRA o dólar: positivo
            = a moeda se valorizou. Pares cotados com o USD na base (USD/JPY, USD/BRL...) têm o
            retorno do par invertido (preço inicial/preço final − 1). Janelas em pregões: 1D=1,
            1S=5, 1M=21, 3M=63, 1A=252 — os mesmos shifts do fx_top_movers, o que mantém as duas
            fontes comparáveis.
          </p>
          <p>
            <strong>Manchete.</strong> Gerada por regra: força do dólar pelo Δ1d do DXY (banda de
            estabilidade ±{fmtNum(DXY_HEADLINE_BAND_PCT, 2)}%), melhor/pior moeda do dia no universo
            coberto e posição do real no ranking 1d dos emergentes.
          </p>
          <p>
            <strong>DXY.</strong> Índice ICE do dólar contra EUR, JPY, GBP, CAD, SEK e CHF — não
            inclui moedas emergentes.
          </p>
        </div>
      }
    />
  );
}

/** Linhas da tabela completa de um bloco (Majors/Emergentes), com header de seção. */
function SectionRows({ group, rows }: { group: "majors" | "emergentes"; rows: FxRow[] }) {
  const groupRows = rows.filter((r) => r.def.group === group);
  const label = group === "majors" ? "Majors (G10 + nórdicas)" : "Emergentes";
  return (
    <>
      <tr>
        <td colSpan={3 + PANORAMA_PERIODS.length} className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#027DFC]">
          {label}
        </td>
      </tr>
      {groupRows.map((r) => {
        const isBrl = r.def.code === "BRL";
        return (
          <tr
            key={r.def.ticker}
            className={`border-b border-zinc-100 ${isBrl ? "bg-[#ebf4ff]/60 font-semibold" : ""}`}
          >
            <td className="py-1.5 pr-2 text-[#132960]">
              {r.def.name}
              <span className="ml-1 text-[10px] font-normal text-zinc-400">{r.def.code}</span>
            </td>
            <td className="py-1.5 pr-2 text-xs text-zinc-500">{r.def.pair}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums text-[#132960]">
              {fmtQuote(r.quote)}
              {r.source == null ? (
                <span className="ml-1 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700">
                  histórico em construção
                </span>
              ) : null}
            </td>
            {PANORAMA_PERIODS.map((p) => {
              const v = r.returns[p.id];
              return (
                <td
                  key={p.id}
                  className="py-1.5 pl-2 text-right tabular-nums"
                  style={{ color: v != null ? variationText(v) : "#a1a1aa" }}
                >
                  {v != null ? fmtSignedPct(v, 2) : "—"}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
