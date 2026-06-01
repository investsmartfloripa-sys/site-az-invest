"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  TIME_WINDOW_OPTIONS,
  TimeWindowToggle,
  type TimeWindow,
} from "@/components/painel/fii/TimeWindowToggle";
import type {
  FiiMacroChartsData,
  FiiPremioPoint,
  FiiPvpPoint,
} from "@/lib/painel-fii";

const TIJOLO_COLOR = "#A16207"; // âmbar (representa tijolo físico)
const PAPEL_COLOR = "#0EA5E9"; // azul claro (representa papel/CRI)
const NTNB_COLOR = "#7E22CE"; // roxo
const PREMIO_COLOR = "#16A34A"; // verde

type Props = {
  data: FiiMacroChartsData;
};

function clipByWindow<T extends { date: string }>(arr: T[], winId: TimeWindow): T[] {
  if (!arr.length) return [];
  const days = TIME_WINDOW_OPTIONS.find((o) => o.id === winId)?.days ?? 365 * 5;
  const last = new Date(arr[arr.length - 1].date + "T00:00:00Z").getTime();
  const cutoff = last - days * 86_400_000;
  return arr.filter((p) => new Date(p.date + "T00:00:00Z").getTime() >= cutoff);
}

function formatAxisDate(d: string, span: TimeWindow): string {
  const dt = new Date(d + "T00:00:00Z");
  if (span === "7d" || span === "5d" || span === "30d") {
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  }
  return dt.toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

// Merge tijolo + papel. Adiciona colunas auxiliares pra renderizar Area entre P25 e P75
// (Recharts não suporta "Area between" direto — usa stacked Area com base = p25 e
// altura = p75 - p25, transparente em cima da base).
function buildPvpData(tijolo: FiiPvpPoint[], papel: FiiPvpPoint[]) {
  const byDate: Record<string, Record<string, number | null>> = {};
  for (const p of tijolo) {
    const p25 = p.p25 ?? null;
    const p75 = p.p75 ?? null;
    byDate[p.date] = {
      ...(byDate[p.date] || {}),
      tijolo_median: p.median,
      tijolo_p25: p25,
      tijolo_p75: p75,
      tijolo_band_base: p25,
      tijolo_band_height: p25 != null && p75 != null ? p75 - p25 : null,
      // Desvio vs paridade (em %): -10 = P/VP 0,90; +5 = P/VP 1,05
      tijolo_dev_pct: (p.median - 1) * 100,
    };
  }
  for (const p of papel) {
    const p25 = p.p25 ?? null;
    const p75 = p.p75 ?? null;
    byDate[p.date] = {
      ...(byDate[p.date] || {}),
      papel_median: p.median,
      papel_p25: p25,
      papel_p75: p75,
      papel_band_base: p25,
      papel_band_height: p25 != null && p75 != null ? p75 - p25 : null,
      papel_dev_pct: (p.median - 1) * 100,
    };
  }
  return Object.entries(byDate)
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

export function FiiMacroCharts({ data }: Props) {
  const [pvpWin, setPvpWin] = useState<TimeWindow>("5y");
  const [premWin, setPremWin] = useState<TimeWindow>("5y");

  const pvpClipped = useMemo(() => {
    const tj = clipByWindow(data.pvp_history.tijolo, pvpWin);
    const pp = clipByWindow(data.pvp_history.papel, pvpWin);
    return buildPvpData(tj, pp);
  }, [data, pvpWin]);

  const premioClipped = useMemo(() => clipByWindow(data.premio_history, premWin), [data, premWin]);

  const latestPremio = data.premio_history[data.premio_history.length - 1];
  const latestPvpTj = data.pvp_history.tijolo[data.pvp_history.tijolo.length - 1];
  const latestPvpPp = data.pvp_history.papel[data.pvp_history.papel.length - 1];

  return (
    <section
      aria-label="Macro charts do mercado de FIIs"
      className="grid gap-4 md:grid-cols-2"
    >
      {/* GRÁFICO 1 — P/VP histórico */}
      <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              P/VP mediana dos top 25
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Mediana + banda P25-P75 dos 25 mais líquidos (cesta recomposta todo mês)
            </p>
          </div>
          <TimeWindowToggle value={pvpWin} onChange={setPvpWin} />
        </header>

        <div className="flex gap-4 pb-1 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TIJOLO_COLOR }} />
            <span className="text-zinc-600">Tijolo</span>
            {latestPvpTj ? (
              <strong className="text-[#132960] tabular-nums">{latestPvpTj.median.toFixed(2)}</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PAPEL_COLOR }} />
            <span className="text-zinc-600">Papel</span>
            {latestPvpPp ? (
              <strong className="text-[#132960] tabular-nums">{latestPvpPp.median.toFixed(2)}</strong>
            ) : null}
          </span>
        </div>

        <div style={{ height: 230 }} className="w-full">
          {pvpClipped.length < 2 ? (
            <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
              sem dados na janela
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pvpClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), pvpWin)}
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  minTickGap={32}
                />
                {/* Eixo esquerdo: P/VP absoluto (linhas e bandas) */}
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                  width={42}
                />
                {/* Eixo direito: desvio % vs paridade 1,00 (barras) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${typeof v === "number" ? (v >= 0 ? "+" : "") + v.toFixed(0) : v}%`}
                  width={42}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 6 }}
                  labelFormatter={(d) =>
                    new Date(String(d) + "T00:00:00Z").toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  formatter={(v, name) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return ["—", name];
                    return [n.toFixed(3), name];
                  }}
                />
                {/* Barras de desvio vs paridade (eixo Y direito).
                    Cor escura quando deságio (P/VP<1), clara quando ágio (P/VP>1). */}
                <Bar
                  yAxisId="right"
                  dataKey="tijolo_dev_pct"
                  fill={TIJOLO_COLOR}
                  fillOpacity={0.35}
                  name="Tijolo (% vs paridade)"
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="right"
                  dataKey="papel_dev_pct"
                  fill={PAPEL_COLOR}
                  fillOpacity={0.35}
                  name="Papel (% vs paridade)"
                  isAnimationActive={false}
                />
                {/* Banda P25-P75 tijolo: base invisível + altura sombreada (stack) */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="tijolo_band_base"
                  stackId="tj"
                  stroke="none"
                  fill="transparent"
                  fillOpacity={0}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="tijolo_band_height"
                  stackId="tj"
                  stroke="none"
                  fill={TIJOLO_COLOR}
                  fillOpacity={0.12}
                  name="Tijolo P25-P75"
                  isAnimationActive={false}
                />
                {/* Banda P25-P75 papel: idem */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="papel_band_base"
                  stackId="pp"
                  stroke="none"
                  fill="transparent"
                  fillOpacity={0}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="papel_band_height"
                  stackId="pp"
                  stroke="none"
                  fill={PAPEL_COLOR}
                  fillOpacity={0.12}
                  name="Papel P25-P75"
                  isAnimationActive={false}
                />
                {/* Medianas (linhas cheias) */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tijolo_median"
                  stroke={TIJOLO_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="Tijolo (mediana)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="papel_median"
                  stroke={PAPEL_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="Papel (mediana)"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">
          <strong>Tijolo</strong> = Logística, Lajes, Shoppings, Renda urbana, Residencial,
          Hospitalar, Hotelaria, Educacional, Agro, Varejo. <strong>Papel</strong> = CRI.
          Linhas = mediana. Áreas sombreadas = quartis P25-P75 mensais. <strong>Barras
          (eixo direito)</strong> = desvio % vs paridade (P/VP = 1,00). Acima de 0%, ágio;
          abaixo, deságio. P/VP = preço / VP por cota (CVM Informe Mensal). Não é recomendação.
        </p>
      </article>

      {/* GRÁFICO 2 — Prêmio NTN-B vs DY tijolo */}
      <article className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-2 pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Prêmio FII tijolo vs NTN-B
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              DY 12m mediana top 25 tijolo − yield NTN-B mais longa (TD)
            </p>
          </div>
          <TimeWindowToggle value={premWin} onChange={setPremWin} />
        </header>

        <div className="flex flex-wrap gap-4 pb-1 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TIJOLO_COLOR }} />
            <span className="text-zinc-600">DY tijolo</span>
            {latestPremio ? (
              <strong className="text-[#132960] tabular-nums">{latestPremio.dy_tijolo_pct.toFixed(2)}%</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NTNB_COLOR }} />
            <span className="text-zinc-600">NTN-B</span>
            {latestPremio ? (
              <strong className="text-[#132960] tabular-nums">{latestPremio.ntnb_yield_pct.toFixed(2)}%</strong>
            ) : null}
            {latestPremio?.ntnb_venc ? (
              <span className="text-[10px] text-zinc-400">(venc {latestPremio.ntnb_venc})</span>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PREMIO_COLOR }} />
            <span className="text-zinc-600">Prêmio</span>
            {latestPremio ? (
              <strong className="text-[#132960] tabular-nums">{latestPremio.premio_pp.toFixed(2)} pp</strong>
            ) : null}
          </span>
        </div>

        <div style={{ height: 230 }} className="w-full">
          {premioClipped.length < 2 ? (
            <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
              sem dados na janela
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={premioClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#E4E4E7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), premWin)}
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  minTickGap={32}
                />
                {/* Eixo esquerdo: DY tijolo e NTN-B em % */}
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "#71717A" }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${typeof v === "number" ? v.toFixed(1) : v}%`}
                  width={42}
                />
                {/* Eixo direito: Prêmio em pp (escala separada pra não esmagar) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: PREMIO_COLOR }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${typeof v === "number" ? v.toFixed(1) : v} pp`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: "6px 10px", borderRadius: 6 }}
                  labelFormatter={(d) =>
                    new Date(String(d) + "T00:00:00Z").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  }
                  formatter={(v, name) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return ["—", name];
                    const suffix = name === "Prêmio (pp)" ? " pp" : "%";
                    return [n.toFixed(2) + suffix, name];
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="dy_tijolo_pct"
                  stroke={TIJOLO_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="DY tijolo (12m)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ntnb_yield_pct"
                  stroke={NTNB_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="NTN-B (yield real)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="premio_pp"
                  stroke={PREMIO_COLOR}
                  strokeWidth={2}
                  strokeDasharray="3 2"
                  dot={false}
                  name="Prêmio (pp)"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">
          DY 12m = soma dividendos 12m / preço atual por FII (yfinance), mediana dos top 25 tijolo.
          NTN-B = yield real Taxa Compra (Tesouro Direto) do título IPCA+ sem cupom mais longo de
          cada dia (vencimento muda ao longo do tempo — hoje 2050, antes 2045). Eixo direito = Prêmio
          em pp. Indicador histórico — <strong>não é recomendação</strong>. FII tem risco de cota,
          vacância e crédito que NTN-B não tem.
        </p>
      </article>
    </section>
  );
}
