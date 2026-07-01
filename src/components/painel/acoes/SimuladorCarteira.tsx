"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { saveAcoesSimLead } from "@/components/painel/acoes/acoes-sim-lead-action";
import { AzTimeSeriesChart, type AzSeriesPoint } from "@/components/painel/charts";
import { MethodInfo } from "@/components/painel/core/MethodInfo";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";
import {
  alignPanel,
  annualizedFromSeries,
  efficientFrontier,
  portfolioSeries,
  seriesStats,
  type SimAsset,
} from "@/lib/carteira-sim";
import { fmtBRL, fmtNum, fmtSignedPct } from "@/lib/format-br";

/**
 * Simulador de carteira da renda variável — o usuário monta uma carteira com
 * as ações selecionadas no comparador, ajusta pesos e valor, e vê:
 *   GRÁTIS: curva da carteira vs Ibovespa vs CDI + retorno/vol.
 *   COM CADASTRO (gate de lead, blur): dividendos projetados, máx drawdown,
 *   Sharpe e fronteira eficiente com as carteiras ótimas.
 *
 * Motor em `src/lib/carteira-sim.ts` (agnóstico — reusar nos FIIs).
 */

export type SimAssetInput = {
  ticker: string;
  color: string;
  series: ReadonlyArray<AzSeriesPoint>;
  /** DY 12m (%) do screener — projeção de dividendos. */
  dy12m: number | null;
  /** Valor de mercado (R$) — atalho "ponderar por tamanho". */
  marketCap: number | null;
};

type Props = {
  assets: SimAssetInput[];
  /** Série do índice de referência em pontos (Ibovespa nas ações, IFIX nos FIIs). */
  ibovSeries: ReadonlyArray<AzSeriesPoint>;
  /** Série do CDI acumulado (base 100) — taxa livre de risco. */
  cdiSeries: ReadonlyArray<AzSeriesPoint>;
  /** Rótulo do índice de referência. Default "Ibovespa". */
  benchLabel?: string;
};

const UNLOCK_KEY = "az-sim-carteira-unlocked";
const WINDOW_YEARS = 3;

function isoYearsAgo(years: number): string {
  return new Date(Date.now() - years * 365.2425 * 86_400_000).toISOString().slice(0, 10);
}

function parseValor(s: string): number {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function SimuladorCarteira({ assets, ibovSeries, cdiSeries, benchLabel = "Ibovespa" }: Props) {
  const benchShort = benchLabel === "Ibovespa" ? "Ibov" : benchLabel;
  const [open, setOpen] = useState(false);
  const [valorStr, setValorStr] = useState("10.000");
  /** Pesos BRUTOS por ticker (0–100 no slider); normalizados no cálculo. */
  const [rawW, setRawW] = useState<Record<string, number>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      /* storage indisponível (modo privado) — segue bloqueado */
    }
  }, []);

  // Pesos default: iguais. Ticker NOVO entra com a MÉDIA dos pesos brutos já
  // existentes — assim quem nunca mexeu nos sliders fica igualitário mesmo com
  // as séries chegando em ordens diferentes (o fetch de cada papel é async).
  useEffect(() => {
    setRawW((prev) => {
      const existentes = assets.filter((a) => prev[a.ticker] != null);
      const media =
        existentes.length > 0
          ? existentes.reduce((s, a) => s + prev[a.ticker], 0) / existentes.length
          : 100 / assets.length;
      const next: Record<string, number> = {};
      for (const a of assets) next[a.ticker] = prev[a.ticker] ?? media;
      return next;
    });
  }, [assets]);

  const tickers = assets.map((a) => a.ticker);
  const rawSum = tickers.reduce((s, t) => s + (rawW[t] ?? 0), 0);
  const weights = tickers.map((t) => (rawSum > 0 ? (rawW[t] ?? 0) / rawSum : 1 / tickers.length));
  const valor = parseValor(valorStr);

  function setEqual() {
    const w: Record<string, number> = {};
    for (const t of tickers) w[t] = 100 / tickers.length;
    setRawW(w);
  }
  function setByMarketCap() {
    const caps = assets.map((a) => a.marketCap ?? 0);
    const sum = caps.reduce((a, b) => a + b, 0);
    if (sum <= 0) return;
    const w: Record<string, number> = {};
    assets.forEach((a, i) => {
      w[a.ticker] = (100 * caps[i]) / sum;
    });
    setRawW(w);
  }

  // ── Motor ────────────────────────────────────────────────────────────────
  const fromISO = useMemo(() => isoYearsAgo(WINDOW_YEARS), []);

  const panel = useMemo(() => {
    const simAssets: SimAsset[] = assets.map((a) => ({ ticker: a.ticker, series: a.series }));
    return alignPanel(simAssets, fromISO);
  }, [assets, fromISO]);

  const cdiAnnual = useMemo(() => {
    const clipped = cdiSeries.filter(([d]) => d >= fromISO);
    return annualizedFromSeries(clipped) ?? 10;
  }, [cdiSeries, fromISO]);

  const carteira = useMemo(
    () => (panel && valor > 0 ? portfolioSeries(panel, weights, valor) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, JSON.stringify(weights), valor],
  );
  const stats = useMemo(
    () => (carteira ? seriesStats(carteira, cdiAnnual) : null),
    [carteira, cdiAnnual],
  );
  const ibovStats = useMemo(() => {
    if (!panel) return null;
    const first = panel.dates[0];
    const last = panel.dates[panel.dates.length - 1];
    const clipped = ibovSeries.filter(([d]) => d >= first && d <= last);
    return seriesStats(clipped, cdiAnnual);
  }, [panel, ibovSeries, cdiAnnual]);

  const frontier = useMemo(
    () => (panel ? efficientFrontier(panel, cdiAnnual) : null),
    [panel, cdiAnnual],
  );
  const userPoint = useMemo(() => {
    if (!stats) return null;
    return { volPct: stats.volPct, retPct: stats.cagrPct };
  }, [stats]);

  // Dividendos projetados 12m = Σ peso × DY × valor (yield corrente).
  const divProj = useMemo(() => {
    let anual = 0;
    let cobertos = 0;
    assets.forEach((a, i) => {
      if (a.dy12m != null) {
        anual += weights[i] * (a.dy12m / 100) * valor;
        cobertos++;
      }
    });
    return { anual, mensal: anual / 12, cobertura: cobertos / Math.max(assets.length, 1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, JSON.stringify(weights), valor]);

  const carteiraJson = useMemo(
    () =>
      JSON.stringify({
        valorInicial: valor,
        ativos: assets.map((a, i) => ({ ticker: a.ticker, pesoPct: Math.round(weights[i] * 1000) / 10 })),
        janelaAnos: WINDOW_YEARS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, JSON.stringify(weights), valor],
  );

  async function onSubmitLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await saveAcoesSimLead(fd);
      if (res.ok) {
        setUnlocked(true);
        try {
          localStorage.setItem(UNLOCK_KEY, "1");
        } catch {
          /* sem storage: destrava só nesta visita */
        }
      } else {
        setFormError(res.error);
      }
    } catch {
      setFormError("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (assets.length < 2) return null;

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[#132960] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e1f4a]"
        >
          Simular carteira com esses {assets.length} papéis →
        </button>
      </div>
    );
  }

  const chartSeries = carteira
    ? [
        { id: "carteira", label: "Sua carteira", color: AZ_BRAND.azure, data: carteira },
        {
          id: "bench",
          label: benchLabel,
          color: "#132960",
          data: ibovSeries.filter(([d]) => d >= (panel?.dates[0] ?? fromISO)),
        },
        {
          id: "cdi",
          label: "CDI",
          color: "#A16207",
          data: cdiSeries.filter(([d]) => d >= (panel?.dates[0] ?? fromISO)),
        },
      ]
    : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#132960]/15 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#132960] px-4 py-3 md:px-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white md:text-lg">
          Simulador de carteira
          <MethodInfo className="align-middle">
            Simulação com as séries de retorno total (preço + dividendos reinvestidos) dos últimos{" "}
            {WINDOW_YEARS} anos, com rebalanceamento MENSAL para os pesos-alvo. Vol = desvio-padrão
            dos retornos diários anualizado (√252). Dividendos projetados usam o DY 12m corrente de
            cada papel (não é promessa de rendimento). Fronteira eficiente = Markowitz long-only
            sobre a matriz de covariância diária; Sharpe usa o CDI do período como taxa livre de
            risco. Simulação educacional — não é recomendação de investimento.
          </MethodInfo>
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-[#9db8e8] transition hover:text-white"
        >
          fechar ×
        </button>
      </div>

      <div className="space-y-5 p-4 md:p-6">
        {/* ── Controles: valor + pesos ── */}
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Valor investido (R$)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#132960]/20 px-3 py-2 text-sm font-semibold text-[#132960] outline-none focus:border-[#027DFC]"
            />
          </label>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Pesos da carteira
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={setEqual}
                  className="rounded-full border border-[#132960]/15 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#027DFC]"
                >
                  Iguais
                </button>
                <button
                  type="button"
                  onClick={setByMarketCap}
                  className="rounded-full border border-[#132960]/15 px-2.5 py-1 text-[11px] font-semibold text-[#132960] transition hover:border-[#027DFC]"
                >
                  Por valor de mercado
                </button>
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {assets.map((a, i) => (
                <div key={a.ticker} className="flex items-center gap-3">
                  <span className="inline-flex w-24 items-center gap-1.5 text-xs font-semibold text-[#132960]">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                    {a.ticker}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={rawW[a.ticker] ?? 0}
                    onChange={(e) =>
                      setRawW((prev) => ({ ...prev, [a.ticker]: Number(e.target.value) }))
                    }
                    className="h-1.5 flex-1 accent-[#027DFC]"
                    aria-label={`Peso de ${a.ticker}`}
                  />
                  <span className="w-12 text-right text-xs font-semibold tabular-nums text-zinc-600">
                    {fmtNum(weights[i] * 100, 1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {panel == null || carteira == null || stats == null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Histórico comum insuficiente para simular esta combinação (papéis muito recentes).
          </p>
        ) : (
          <>
            {/* ── GRÁTIS: curva + retorno/vol ── */}
            <AzTimeSeriesChart
              series={chartSeries}
              mode="pct_acum"
              period={{ id: "max" }}
              height={300}
              forwardFill
              seriesEndLabels
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiBox
                label={`Retorno (${WINDOW_YEARS} anos)`}
                value={fmtSignedPct(stats.totalPct, 1)}
                tone={stats.totalPct >= 0 ? "pos" : "neg"}
                sub={ibovStats ? `${benchShort}: ${fmtSignedPct(ibovStats.totalPct, 1)}` : undefined}
              />
              <KpiBox
                label="Retorno anualizado"
                value={fmtSignedPct(stats.cagrPct, 1)}
                tone={stats.cagrPct >= 0 ? "pos" : "neg"}
                sub={`CDI: ${fmtNum(cdiAnnual, 1)}% a.a.`}
              />
              <KpiBox label="Volatilidade anual" value={`${fmtNum(stats.volPct, 1)}%`} tone="neutral" sub={ibovStats ? `${benchShort}: ${fmtNum(ibovStats.volPct, 1)}%` : undefined} />
              <KpiBox
                label="Valor final simulado"
                value={fmtBRL(carteira[carteira.length - 1][1])}
                tone="neutral"
                sub={`de ${fmtBRL(valor)}`}
              />
            </div>

            {/* ── GATED: dividendos + risco + fronteira ── */}
            <div className="relative">
              <div className={unlocked ? "" : "pointer-events-none select-none blur-[7px]"} aria-hidden={!unlocked}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <KpiBox
                    label="Dividendos projetados/ano"
                    value={fmtBRL(divProj.anual)}
                    tone="pos"
                    sub={`~${fmtBRL(divProj.mensal)}/mês (DY corrente)`}
                  />
                  <KpiBox
                    label="Máximo drawdown"
                    value={fmtSignedPct(stats.maxDrawdownPct, 1)}
                    tone="neg"
                    sub={ibovStats ? `${benchShort}: ${fmtSignedPct(ibovStats.maxDrawdownPct, 1)}` : undefined}
                  />
                  <KpiBox
                    label="Sharpe (vs CDI)"
                    value={stats.sharpe == null ? "—" : fmtNum(stats.sharpe, 2)}
                    tone="neutral"
                    sub={stats.sharpe != null && stats.sharpe > 0 ? "acima do CDI por unidade de risco" : undefined}
                  />
                  <KpiBox
                    label="Carteira máx. Sharpe"
                    value={
                      frontier
                        ? frontier.maxSharpe.weights
                            .map((w, i) => (w >= 0.005 ? `${tickers[i]} ${Math.round(w * 100)}%` : null))
                            .filter(Boolean)
                            .slice(0, 3)
                            .join(" · ")
                        : "—"
                    }
                    tone="neutral"
                    small
                  />
                </div>

                {frontier && userPoint ? (
                  <FronteiraChart
                    frontier={frontier}
                    userPoint={userPoint}
                    ibovPoint={ibovStats ? { volPct: ibovStats.volPct, retPct: ibovStats.cagrPct } : null}
                    tickers={tickers}
                    benchLabel={benchLabel}
                  />
                ) : null}
              </div>

              {!unlocked ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-3">
                  <form
                    onSubmit={onSubmitLead}
                    className="w-full max-w-md rounded-2xl border border-[#132960]/15 bg-white/95 p-5 shadow-xl backdrop-blur-sm"
                  >
                    <p className="text-sm font-bold text-[#132960]">
                      Desbloqueie a análise completa da sua carteira
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Dividendos projetados, risco máximo (drawdown) e a fronteira eficiente com a
                      combinação ótima desses papéis — grátis, com seu contato.
                    </p>
                    <input type="hidden" name="carteira" value={carteiraJson} />
                    <input type="hidden" name="valorInicial" value={valorStr} />
                    <div className="mt-3 space-y-2">
                      <input
                        name="name"
                        required
                        placeholder="Seu nome*"
                        className="w-full rounded-lg border border-[#132960]/20 px-3 py-2 text-sm outline-none focus:border-[#027DFC]"
                      />
                      <input
                        name="phone"
                        required
                        inputMode="tel"
                        placeholder="WhatsApp com DDD*"
                        className="w-full rounded-lg border border-[#132960]/20 px-3 py-2 text-sm outline-none focus:border-[#027DFC]"
                      />
                      <input
                        name="email"
                        type="email"
                        placeholder="E-mail (opcional)"
                        className="w-full rounded-lg border border-[#132960]/20 px-3 py-2 text-sm outline-none focus:border-[#027DFC]"
                      />
                    </div>
                    {formError ? <p className="mt-2 text-xs font-medium text-[#BE3B33]">{formError}</p> : null}
                    <button
                      type="submit"
                      disabled={sending}
                      className="mt-3 w-full rounded-lg bg-[#FF5713] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64c0f] disabled:opacity-60"
                    >
                      {sending ? "Enviando…" : "Ver análise completa"}
                    </button>
                    <p className="mt-2 text-[10px] leading-snug text-zinc-400">
                      Ao enviar, você autoriza o contato da equipe AZ Invest sobre investimentos.
                      Simulação educacional — não é recomendação.
                    </p>
                  </form>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function KpiBox({
  label,
  value,
  sub,
  tone,
  small = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "pos" | "neg" | "neutral";
  small?: boolean;
}) {
  const color = tone === "pos" ? "#1E8A5C" : tone === "neg" ? "#BE3B33" : "#132960";
  return (
    <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p
        className={`mt-1 font-bold tabular-nums ${small ? "text-xs leading-snug" : "text-lg"}`}
        style={{ color }}
      >
        {value}
      </p>
      {sub ? <p className="text-[10px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function FronteiraChart({
  frontier,
  userPoint,
  ibovPoint,
  tickers,
  benchLabel,
}: {
  frontier: NonNullable<ReturnType<typeof efficientFrontier>>;
  userPoint: { volPct: number; retPct: number };
  ibovPoint: { volPct: number; retPct: number } | null;
  tickers: string[];
  benchLabel: string;
}) {
  // Nuvem reduzida p/ render leve (a fronteira/pontos notáveis ficam completos).
  const cloud = frontier.cloud.filter((_, i) => i % 5 === 0).map((p) => ({ x: p.volPct, y: p.retPct }));
  const line = frontier.frontier.map((p) => ({ x: p.volPct, y: p.retPct }));
  const singles = frontier.singles.map((p, i) => ({ x: p.volPct, y: p.retPct, name: tickers[i] }));

  return (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Fronteira eficiente — risco × retorno (anualizados, {""}
        <span className="normal-case">3 anos</span>)
      </p>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid stroke={AZ_CHART.grid} strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="x"
              name="Risco"
              unit="%"
              tick={{ fontSize: 10, fill: AZ_CHART.ticks }}
              label={{ value: "Vol anual (%)", position: "insideBottom", offset: -4, fontSize: 10, fill: AZ_CHART.ticks }}
              domain={["auto", "auto"]}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Retorno"
              unit="%"
              width={52}
              tick={{ fontSize: 10, fill: AZ_CHART.ticks }}
              label={{ value: "Retorno a.a. (%)", angle: -90, position: "insideLeft", fontSize: 10, fill: AZ_CHART.ticks }}
              domain={["auto", "auto"]}
            />
            <ZAxis range={[18, 18]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(v) => (typeof v === "number" ? `${fmtNum(v, 1)}%` : String(v ?? ""))}
              contentStyle={{
                background: AZ_BRAND.navy,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 11,
              }}
            />
            <Scatter name="Carteiras possíveis" data={cloud} fill="#CBD5E1" fillOpacity={0.5} />
            <Scatter name="Fronteira eficiente" data={line} fill="#027DFC" line={{ stroke: "#027DFC", strokeWidth: 2 }} />
            <Scatter name="Ações" data={singles} fill="#64748B" />
            <Scatter name="Mín. variância" data={[{ x: frontier.minVar.volPct, y: frontier.minVar.retPct }]} fill="#1E8A5C" />
            <Scatter name="Máx. Sharpe" data={[{ x: frontier.maxSharpe.volPct, y: frontier.maxSharpe.retPct }]} fill="#FF5713" />
            <Scatter name="Sua carteira" data={[{ x: userPoint.volPct, y: userPoint.retPct }]} fill="#132960" shape="star" />
            {ibovPoint ? <Scatter name={benchLabel} data={[{ x: ibovPoint.volPct, y: ibovPoint.retPct }]} fill="#A16207" shape="diamond" /> : null}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
        <LegendDot color="#132960" label="Sua carteira (estrela)" />
        <LegendDot color="#FF5713" label="Máx. Sharpe" />
        <LegendDot color="#1E8A5C" label="Mín. variância" />
        <LegendDot color="#A16207" label={`${benchLabel} (losango)`} />
        <LegendDot color="#027DFC" label="Fronteira" />
        <LegendDot color="#64748B" label="Ações individuais" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
