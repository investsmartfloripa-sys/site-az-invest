"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import { AzTooltip, azTooltipProps } from "@/components/painel/core/AzTooltip";
import { azGridProps, azXAxisProps, azYAxisProps } from "@/components/painel/core/azChartDefaults";
import {
  TimeWindowToggle,
  timeWindowStartIso,
  type TimeWindow,
} from "@/components/painel/fii/TimeWindowToggle";
import { AZ_BRAND, variationText } from "@/lib/az-chart-theme";
import {
  diffDaysUTC,
  fmtBRL,
  fmtDataBR,
  fmtNum,
  fmtPct,
  fmtSignedPct,
  formatAxisDate,
} from "@/lib/format-br";
import type { FiiDetailEntry } from "@/lib/painel-fii";

/** Valores grandes abreviados: R$ 1,23 Bi / R$ 45,60 M (decimais pt-BR via fmtNum). */
function formatBig(value: number | null | undefined, currency = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const prefix = currency ? `${currency} ` : "";
  if (abs >= 1e9) return `${prefix}${fmtNum(value / 1e9, 2)} Bi`;
  if (abs >= 1e6) return `${prefix}${fmtNum(value / 1e6, 2)} M`;
  return `${prefix}${fmtNum(value, 0)}`;
}

function clipWindow(series: Array<{ date: string; close: number }>, windowId: TimeWindow) {
  if (!series.length) return [];
  const start = timeWindowStartIso(series[series.length - 1].date, windowId);
  return start ? series.filter((p) => p.date >= start) : series;
}

type Props = { entry: FiiDetailEntry; generatedAt?: string | null };

export function FiiDetailHero({ entry, generatedAt }: Props) {
  const [windowId, setWindowId] = useState<TimeWindow>("1y");
  const clipped = useMemo(() => clipWindow(entry.price_series_daily, windowId), [entry, windowId]);
  // Janela visível em dias corridos — alimenta o tick adaptativo (dd/mm → mai/26 → 2026).
  const spanDays = useMemo(
    () =>
      clipped.length > 1
        ? Math.max(1, diffDaysUTC(clipped[0].date, clipped[clipped.length - 1].date))
        : 1,
    [clipped],
  );

  const hero = entry.hero;

  // Detecção de evento societário (desdobramento, amortização extraordinária):
  // se a cotação caiu mais de 50% no melhor caso dos últimos 12m, é quase
  // certo que houve evento. Banner avisa o leitor que o histórico não pode
  // ser comparado de cabeça.
  const corporateEvent =
    hero.max_12m != null && hero.min_12m != null && hero.price != null && hero.max_12m > 0
      ? (hero.max_12m - hero.min_12m) / hero.max_12m > 0.5
      : false;

  return (
    <section
      aria-label={`${entry.ticker} — Hero`}
      className="space-y-4 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      {(entry.dy_atypical || corporateEvent) ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <p className="font-semibold uppercase tracking-wide text-amber-800">
            Atenção — leia antes de interpretar os números
          </p>
          <ul className="mt-1 list-disc pl-5 leading-relaxed">
            {entry.dy_atypical ? (
              <li>
                <strong>DY 12m acima de 18%</strong>: pode incluir{" "}
                <strong>devolução de capital</strong> (amortização extraordinária) tratada como
                rendimento pelo provedor de dados. Confira a tabela de Rendimentos abaixo e o
                relatório gerencial da gestora antes de tratar como renda recorrente.
              </li>
            ) : null}
            {corporateEvent ? (
              <li>
                <strong>Variação de cotação superior a 50% nos últimos 12 meses</strong>: indica
                provável <strong>desdobramento, agrupamento ou evento societário</strong> — o
                histórico do gráfico pode não ser comparável diretamente. Verifique fatos
                relevantes do fundo.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {/* Linha de KPIs grandes */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-6">
        {/* Ticker badge */}
        <div className="flex items-center">
          <span className="rounded-md border-2 border-[#132960] px-3 py-1.5 text-base font-bold tracking-wider text-[#132960]">
            {entry.ticker}
          </span>
        </div>
        <KpiBlock
          label="Dividend Yield"
          value={fmtPct(hero.dy_12m_pct, 2)}
          tooltip={entry.dy_atypical ? "DY > 18% pode incluir amortização." : undefined}
        />
        <KpiBlock
          label="Último Rendimento"
          value={hero.last_dividend_brl != null ? fmtBRL(hero.last_dividend_brl, 4) : "—"}
          sub={hero.last_dividend_date ? fmtDataBR(hero.last_dividend_date) : undefined}
        />
        <KpiBlock label="Patrimônio Líquido" value={formatBig(hero.pl, "R$")} sub={hero.pl_ref_date ? `ref ${fmtDataBR(hero.pl_ref_date)}` : undefined} />
        <KpiBlock
          label="P/VP"
          value={hero.pvp != null ? fmtNum(hero.pvp, 3) : "—"}
          sub={
            hero.pvp == null
              ? "VP/cota indisponível"
              : entry.pvp_warning
              ? "P/VP < 0,7 — possível distress"
              : undefined
          }
          tooltip={
            hero.pvp == null
              ? "Valor Patrimonial por cota reportado pela CVM está em escala inconsistente para este FII (não publicado em base por cota nominal). Ratio omitido para evitar exibir P/VP incorreto."
              : entry.pvp_warning
              ? "P/VP < 0,7 pode indicar distress (vacância alta, problema de crédito da carteira CRI). Verifique relatório gerencial."
              : undefined
          }
        />
      </div>

      {/* Cotação + gráfico */}
      <div className="grid gap-4 md:grid-cols-[minmax(180px,220px),1fr]">
        <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cotação</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#132960]">
            {hero.price != null ? fmtNum(hero.price, 2) : "—"}
          </p>
          {hero.change_pct_1d != null ? (
            <p
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: variationText(hero.change_pct_1d) }}
            >
              {fmtSignedPct(hero.change_pct_1d, 2)}
            </p>
          ) : null}
          <dl className="mt-3 space-y-1 text-[11px] text-zinc-600">
            <div className="flex items-center justify-between">
              <dt>Máxima 12m</dt>
              <dd className="font-semibold tabular-nums text-[#132960]">{hero.max_12m != null ? fmtNum(hero.max_12m, 2) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Mínima 12m</dt>
              <dd className="font-semibold tabular-nums text-[#132960]">{hero.min_12m != null ? fmtNum(hero.min_12m, 2) : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cotação histórica
            </p>
            <TimeWindowToggle value={windowId} onChange={setWindowId} />
          </div>
          <div style={{ height: 200 }} className="w-full">
            {clipped.length < 2 ? (
              <div className="flex h-full items-center justify-center text-xs italic text-zinc-400">
                sem dados na janela
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={clipped} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid {...azGridProps()} />
                  <XAxis
                    {...azXAxisProps()}
                    dataKey="date"
                    tickFormatter={(d) => formatAxisDate(String(d), spanDays)}
                    minTickGap={32}
                  />
                  <YAxis
                    {...azYAxisProps()}
                    domain={["auto", "auto"]}
                    width={48}
                    tickFormatter={(v) => (typeof v === "number" ? fmtNum(v, 2) : String(v))}
                  />
                  <Tooltip
                    content={
                      <AzTooltip
                        labelFmt={(l) => fmtDataBR(String(l))}
                        valueFmt={(v) => fmtBRL(v)}
                        hideDot
                      />
                    }
                    cursor={azTooltipProps().cursor}
                  />
                  <Line type="monotone" dataKey="close" name="Cotação" stroke={AZ_BRAND.azure} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-right">
        <DataStamp
          giro={generatedAt ?? null}
          dado={
            entry.price_series_daily[entry.price_series_daily.length - 1]?.date ??
            hero.price_date
          }
        />
      </p>
    </section>
  );
}

function KpiBlock({ label, value, sub, tooltip }: { label: string; value: string; sub?: string; tooltip?: string }) {
  return (
    <div className="flex flex-col" title={tooltip}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums text-[#132960] md:text-xl ${tooltip ? "cursor-help" : ""}`}>
        {value}
        {tooltip ? <span className="text-amber-700">*</span> : null}
      </p>
      {sub ? <p className="text-[10px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}
