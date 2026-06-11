"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import {
  AzPeriodSelector,
  resolvePeriodRange,
  type AzPeriodValue,
} from "@/components/painel/charts";
import {
  AzTooltip,
  azGridProps,
  azTooltipProps,
  azXAxisProps,
  azYAxisProps,
  azZeroLineProps,
} from "@/components/painel/core";
import { AZ_BRAND, AZ_CHART, AZ_SERIES, AZ_TOOLTIP_PROPS, BENCHMARK_COLORS } from "@/lib/az-chart-theme";
import {
  diffDaysUTC,
  fmtDataBR,
  fmtMesLongo,
  fmtNum,
  fmtPct,
  fmtSignedNum,
  formatAxisDate,
} from "@/lib/format-br";
import type { FiiMacroChartsData, FiiPvpPoint } from "@/lib/painel-fii";

// Paleta 100% do tema AZ (az-chart-theme) — nenhum hex local.
const TIJOLO_COLOR = AZ_SERIES[0]; // azul AZ — 1ª série categórica
const PAPEL_COLOR = AZ_SERIES[1]; // navy — 2ª série categórica
const NTNB_COLOR = BENCHMARK_COLORS["NTN-B"]; // ocre — cor FIXA do benchmark no site inteiro
const PREMIO_COLOR = AZ_BRAND.rust; // prêmio = série derivada em destaque

type Props = {
  data: FiiMacroChartsData;
};

// Corte pela janela do AzPeriodSelector — resolvePeriodRange trata os
// presets E o range custom (from/to) em aritmética 100% UTC (§8 do padrão).
// `min`/`max` são o range DISPONÍVEL (pode ser a união de duas séries irmãs,
// como tijolo+papel — garante o mesmo recorte nas duas).
function clipByPeriod<T extends { date: string }>(
  arr: T[],
  period: AzPeriodValue,
  min: string,
  max: string,
): T[] {
  if (!arr.length) return [];
  const { from, to } = resolvePeriodRange(period, min, max);
  return arr.filter((p) => p.date >= from && p.date <= to);
}

/** Dias corridos entre o 1º e o último ponto plotado (p/ ticks adaptativos do format-br). */
function spanDaysOf(arr: ReadonlyArray<{ date: string }>): number {
  if (arr.length < 2) return 1;
  return Math.max(1, diffDaysUTC(arr[0].date, arr[arr.length - 1].date));
}

type PvpRow = {
  date: string;
  tijolo_median: number | null;
  /** Banda P25–P75 nativa do Recharts 3: Area com dataKey=[low, high]. */
  tijolo_band: [number, number] | null;
  papel_median: number | null;
  papel_band: [number, number] | null;
};

// Merge tijolo + papel por data. A banda P25–P75 vira o par [low, high] que a
// Area do Recharts 3 plota nativamente — sem o antigo stack-hack base+altura.
function buildPvpData(tijolo: FiiPvpPoint[], papel: FiiPvpPoint[]): PvpRow[] {
  const byDate = new Map<string, PvpRow>();
  const rowFor = (date: string): PvpRow => {
    let r = byDate.get(date);
    if (!r) {
      r = { date, tijolo_median: null, tijolo_band: null, papel_median: null, papel_band: null };
      byDate.set(date, r);
    }
    return r;
  };
  for (const p of tijolo) {
    const r = rowFor(p.date);
    r.tijolo_median = p.median;
    r.tijolo_band = p.p25 != null && p.p75 != null ? [p.p25, p.p75] : null;
  }
  for (const p of papel) {
    const r = rowFor(p.date);
    r.papel_median = p.median;
    r.papel_band = p.p25 != null && p.p75 != null ? [p.p25, p.p75] : null;
  }
  return [...byDate.values()].sort((a, b) => (a.date > b.date ? 1 : -1));
}

export function FiiMacroCharts({ data }: Props) {
  // Seletores §8 controlados (estado local, sem querystring — página estática
  // dispensa Suspense porque o modo controlado não usa useSearchParams).
  const [pvpWin, setPvpWin] = useState<AzPeriodValue>({ id: "5y" });
  const [premWin, setPremWin] = useState<AzPeriodValue>({ id: "5y" });

  // Range disponível do P/VP = UNIÃO tijolo+papel (mesmo recorte p/ as duas).
  const pvpRange = useMemo(() => {
    const firsts = [data.pvp_history.tijolo[0]?.date, data.pvp_history.papel[0]?.date]
      .filter((d): d is string => !!d)
      .sort();
    const lasts = [
      data.pvp_history.tijolo[data.pvp_history.tijolo.length - 1]?.date,
      data.pvp_history.papel[data.pvp_history.papel.length - 1]?.date,
    ]
      .filter((d): d is string => !!d)
      .sort();
    if (!firsts.length || !lasts.length) return null;
    return { min: firsts[0], max: lasts[lasts.length - 1] };
  }, [data]);

  const pvpClipped = useMemo(() => {
    if (!pvpRange) return [];
    const tj = clipByPeriod(data.pvp_history.tijolo, pvpWin, pvpRange.min, pvpRange.max);
    const pp = clipByPeriod(data.pvp_history.papel, pvpWin, pvpRange.min, pvpRange.max);
    return buildPvpData(tj, pp);
  }, [data, pvpWin, pvpRange]);

  const premioMin = data.premio_history[0]?.date;
  const premioMax = data.premio_history[data.premio_history.length - 1]?.date;

  const premioClipped = useMemo(
    () =>
      premioMin && premioMax
        ? clipByPeriod(data.premio_history, premWin, premioMin, premioMax)
        : [],
    [data, premWin, premioMin, premioMax],
  );
  const pvpSpan = useMemo(() => spanDaysOf(pvpClipped), [pvpClipped]);
  const premioSpan = useMemo(() => spanDaysOf(premioClipped), [premioClipped]);

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
          <AzPeriodSelector
            value={pvpWin}
            onChange={setPvpWin}
            min={pvpRange?.min}
            max={pvpRange?.max}
          />
        </header>

        <div className="flex gap-4 pb-1 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TIJOLO_COLOR }} />
            <span className="text-zinc-600">Tijolo</span>
            {latestPvpTj ? (
              <strong className="text-[#132960] tabular-nums">{fmtNum(latestPvpTj.median, 2)}</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PAPEL_COLOR }} />
            <span className="text-zinc-600">Papel</span>
            {latestPvpPp ? (
              <strong className="text-[#132960] tabular-nums">{fmtNum(latestPvpPp.median, 2)}</strong>
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
              {/* EIXO ÚNICO em P/VP: o eixo direito anterior (barras de "desvio %
                  vs paridade") era transformação 1-a-1 da própria mediana — info
                  duplicada com régua própria. A linha de paridade em 1,00 dá a
                  mesma leitura (acima = ágio, abaixo = deságio) sem duplo eixo. */}
              <ComposedChart data={pvpClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis
                  {...azXAxisProps()}
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), pvpSpan)}
                  minTickGap={32}
                />
                <YAxis
                  {...azYAxisProps()}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => fmtNum(Number(v), 2)}
                  width={44}
                />
                <ReferenceLine
                  y={1}
                  stroke={AZ_CHART.zero}
                  strokeOpacity={AZ_CHART.zeroOpacity}
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                  label={{ value: "paridade (1,00)", position: "insideBottomRight", fontSize: 9, fill: AZ_CHART.ticks }}
                />
                <Tooltip
                  {...azTooltipProps()}
                  labelFormatter={(d) => fmtMesLongo(String(d ?? ""))}
                  formatter={(value, name) => {
                    // Bandas chegam como [low, high]; só campos com sentido p/ o
                    // leitor entram (os auxiliares *_band_base/_height morreram).
                    if (Array.isArray(value)) {
                      const lo = Number(value[0]);
                      const hi = Number(value[1]);
                      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return ["—", name];
                      return [`${fmtNum(lo, 2)} – ${fmtNum(hi, 2)}`, name];
                    }
                    const n = typeof value === "number" ? value : Number(value);
                    return [Number.isFinite(n) ? fmtNum(n, 2) : "—", name];
                  }}
                />
                {/* Bandas P25–P75 nativas (Recharts 3: Area com dataKey=[low, high]) */}
                <Area
                  type="monotone"
                  dataKey="tijolo_band"
                  name="Tijolo P25–P75"
                  stroke="none"
                  fill={TIJOLO_COLOR}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="papel_band"
                  name="Papel P25–P75"
                  stroke="none"
                  fill={PAPEL_COLOR}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
                {/* Medianas (linhas cheias) */}
                <Line
                  type="monotone"
                  dataKey="tijolo_median"
                  stroke={TIJOLO_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="Tijolo (mediana)"
                  isAnimationActive={false}
                />
                <Line
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
          Linhas = mediana; faixas sombreadas = quartis P25-P75 mensais. A linha navy marca a
          paridade (P/VP = 1,00): mediana acima dela = ágio, abaixo = deságio. P/VP = preço / VP
          por cota (CVM Informe Mensal). Não é recomendação.
        </p>
        <p className="mt-2 text-right">
          <DataStamp
            giro={data.generated_at}
            dado={latestPvpTj?.date ?? latestPvpPp?.date ?? null}
          />
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
          <AzPeriodSelector
            value={premWin}
            onChange={setPremWin}
            min={premioMin}
            max={premioMax}
          />
        </header>

        <div className="flex flex-wrap gap-4 pb-1 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TIJOLO_COLOR }} />
            <span className="text-zinc-600">DY tijolo</span>
            {latestPremio ? (
              <strong className="text-[#132960] tabular-nums">{fmtPct(latestPremio.dy_tijolo_pct, 2)}</strong>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NTNB_COLOR }} />
            <span className="text-zinc-600">NTN-B</span>
            {latestPremio ? (
              <strong className="text-[#132960] tabular-nums">{fmtPct(latestPremio.ntnb_yield_pct, 2)}</strong>
            ) : null}
            {latestPremio?.ntnb_venc ? (
              <span className="text-[10px] text-zinc-400">(venc {latestPremio.ntnb_venc})</span>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PREMIO_COLOR }} />
            <span className="text-zinc-600">Prêmio</span>
            {latestPremio ? (
              <strong className="text-[#132960] tabular-nums">{fmtSignedNum(latestPremio.premio_pp, 2)} pp</strong>
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
              {/* EIXO ÚNICO: DY (%), NTN-B (%) e prêmio (pp) são a MESMA régua
                  aditiva (prêmio = DY − NTN-B), então o eixo direito anterior só
                  desalinhava a leitura. O zero ganha a linha navy padrão. */}
              <ComposedChart data={premioClipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...azGridProps()} />
                <XAxis
                  {...azXAxisProps()}
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(String(d), premioSpan)}
                  minTickGap={32}
                />
                <YAxis
                  {...azYAxisProps()}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${fmtNum(Number(v), 0)}%`}
                  width={44}
                />
                <ReferenceLine {...azZeroLineProps("y")} ifOverflow="extendDomain" />
                <Tooltip
                  content={
                    <AzTooltip
                      labelFmt={(l) => fmtDataBR(String(l))}
                      valueFmt={(v, name) =>
                        name === "Prêmio" ? `${fmtSignedNum(v, 2)} pp` : fmtPct(v, 2)
                      }
                    />
                  }
                  cursor={AZ_TOOLTIP_PROPS.cursor}
                />
                <Line
                  type="monotone"
                  dataKey="dy_tijolo_pct"
                  stroke={TIJOLO_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="DY tijolo (12m)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ntnb_yield_pct"
                  stroke={NTNB_COLOR}
                  strokeWidth={2}
                  dot={false}
                  name="NTN-B (yield real)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="premio_pp"
                  stroke={PREMIO_COLOR}
                  strokeWidth={2}
                  strokeDasharray="3 2"
                  dot={false}
                  name="Prêmio"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">
          DY 12m = soma dividendos 12m / preço atual por FII (yfinance), mediana dos top 25 tijolo.
          NTN-B = yield real Taxa Compra (Tesouro Direto) do título IPCA+ sem cupom mais longo de
          cada dia (vencimento muda ao longo do tempo — hoje 2050, antes 2045). Prêmio (linha
          tracejada) = DY − NTN-B, em pontos percentuais na mesma escala do eixo. Indicador
          histórico — <strong>não é recomendação</strong>. FII tem risco de cota, vacância e
          crédito que NTN-B não tem.
        </p>
        <p className="mt-2 text-right">
          <DataStamp giro={data.generated_at} dado={latestPremio?.date ?? null} />
        </p>
      </article>
    </section>
  );
}
