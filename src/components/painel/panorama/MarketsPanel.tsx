"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DataStamp from "@/components/painel/DataStamp";
import { AzSegmented } from "@/components/painel/panorama/AzSegmented";
import type { FxMoversPayload } from "@/components/painel/DynamicFxMoversBar";
import type { ByPeriodBlock, Row } from "@/components/painel/DynamicReturnsBar";
import { AZ_CHART } from "@/lib/az-chart-theme";

// Re-export de compatibilidade: a fonte única dos tokens agora é
// src/lib/az-chart-theme.ts — importe de lá em código novo.
export { AZ_CHART } from "@/lib/az-chart-theme";

type PanoramaByPeriod = { generated_at?: string; by_period?: ByPeriodBlock };

type CategoryId = "ativos" | "indices" | "moedas" | "commodities";

const CATEGORIES: { id: CategoryId; label: string; currencyToggle: boolean }[] = [
  { id: "ativos", label: "Ativos", currencyToggle: true },
  { id: "indices", label: "Índices globais", currencyToggle: false },
  { id: "moedas", label: "Moedas", currencyToggle: false },
  { id: "commodities", label: "Commodities", currencyToggle: true },
];

const PERIODS = [
  { id: "1d", label: "1D" },
  { id: "1wk", label: "1S" },
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "1y", label: "1A" },
];

const FX_PERIOD_MAP: Record<string, string> = {
  "1d": "day",
  "1wk": "week",
  "1mo": "month",
  "3mo": "quarter",
  "1y": "year",
};

/** Codigo ISO do pais por palavra-chave do nome do índice global. */
const INDEX_FLAGS: [string, string][] = [
  ["Coreia", "kr"],
  ["Argentina", "ar"],
  ["Taiwan", "tw"],
  ["Colômbia", "co"],
  ["Japão", "jp"],
  ["Espanha", "es"],
  ["EUA", "us"],
  ["Alemanha", "de"],
  ["Singapura", "sg"],
  ["Suíça", "ch"],
  ["México", "mx"],
  ["Reino Unido", "gb"],
  ["China", "cn"],
  ["Índia", "in"],
  ["Hong Kong", "hk"],
  ["Brasil", "br"],
  ["França", "fr"],
  ["Itália", "it"],
  ["Canadá", "ca"],
  ["Austrália", "au"],
];

/** Codigo ISO do pais pelo codigo da moeda (tickers tipo "EUR / USD"). */
const CURRENCY_FLAGS: Record<string, string> = {
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  CNY: "cn",
  MXN: "mx",
  COP: "co",
  CLP: "cl",
  ARS: "ar",
  PEN: "pe",
  ZAR: "za",
  RUB: "ru",
  INR: "in",
  KRW: "kr",
  TRY: "tr",
  CHF: "ch",
  AUD: "au",
  CAD: "ca",
  BRL: "br",
  DXY: "us",
  USD: "us",
};

/**
 * Codigo ISO-3166 (flagcdn) do pais. Emoji de bandeira nao renderiza no
 * Chrome/Windows — usamos imagem SVG no tick do eixo Y.
 */
function flagFor(cat: CategoryId, rawName: string): string {
  if (cat === "indices") {
    for (const [needle, code] of INDEX_FLAGS) {
      if (rawName.includes(needle)) return code;
    }
    return "";
  }
  if (cat === "moedas") {
    const code = rawName.trim().slice(0, 3).toUpperCase();
    return CURRENCY_FLAGS[code] ?? CURRENCY_FLAGS[rawName.trim().toUpperCase()] ?? "";
  }
  return "";
}

/** name codificado como "br|Brasil (EWZ)" — separa flag e rotulo. */
function splitFlagName(encoded: string): { code: string; label: string } {
  const i = encoded.indexOf("|");
  if (i === 2) return { code: encoded.slice(0, 2), label: encoded.slice(3) };
  return { code: "", label: encoded };
}

type YTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
};

/** Tick do eixo Y com bandeira (imagem flagcdn) + nome. */
function FlagYTick({ x = 0, y = 0, payload }: YTickProps) {
  const { code, label } = splitFlagName(String(payload?.value ?? ""));
  const flagW = 15;
  return (
    <g transform={`translate(${x},${y})`}>
      {code ? (
        <image
          href={`https://flagcdn.com/w20/${code}.png`}
          x={-148}
          y={-5.5}
          width={flagW}
          height={11}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : null}
      <text x={code ? -148 + flagW + 4 : -148} y={4} fontSize={11} fill={AZ_CHART.labels}>
        {label.length > 17 ? `${label.slice(0, 16)}…` : label}
      </text>
    </g>
  );
}

type Props = {
  assetPanorama: PanoramaByPeriod | null;
  worldPanorama: PanoramaByPeriod | null;
  fxData: FxMoversPayload | null;
  commPanorama: PanoramaByPeriod | null;
};

type ChartRow = { name: string; value: number };

function truncateName(s: string, max = 20): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function rowsFor(
  cat: CategoryId,
  period: string,
  currency: "brl" | "usd",
  props: Props,
): { rows: ChartRow[]; updatedAt?: string } {
  if (cat === "moedas") {
    const fxPeriod = FX_PERIOD_MAP[period] ?? "month";
    const up = props.fxData?.top?.[fxPeriod as keyof NonNullable<FxMoversPayload["top"]>]?.up ?? [];
    return {
      rows: up
        .map((r) => {
          const raw = String(r.ticker ?? "");
          const code = flagFor("moedas", raw);
          return { name: `${code ? `${code}|` : ""}${truncateName(raw)}`, value: Number(r.change_pct) };
        })
        .filter((r) => Number.isFinite(r.value)),
      updatedAt: props.fxData?.generated_at,
    };
  }

  const source =
    cat === "ativos" ? props.assetPanorama : cat === "indices" ? props.worldPanorama : props.commPanorama;
  const raw: Row[] = source?.by_period?.[period]?.data ?? [];
  const rows: ChartRow[] = [];
  for (const row of raw) {
    if (cat === "ativos" && String(row.ticker ?? "") === "BRL=X") continue;
    let v: unknown;
    if (cat === "indices") {
      v = row.return_pct;
    } else if (cat === "ativos") {
      v = currency === "brl" ? row.return_brl_pct : row.return_usd_pct;
    } else {
      v = currency === "brl" ? row.return_pct_brl : row.return_pct_usd;
    }
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num)) continue;
    const rawName = String(row.name ?? "");
    const code = flagFor(cat, rawName);
    rows.push({ name: `${code ? `${code}|` : ""}${truncateName(rawName)}`, value: num });
  }
  return { rows, updatedAt: source?.generated_at };
}

/**
 * Card unificado de mercados: Ativos | Índices globais | Moedas | Commodities
 * com tabs underline + seletores AzSegmented. Grade vertical estilo ggplot2,
 * linha do zero em navy, valores na ponta das barras.
 */
export function MarketsPanel(props: Props) {
  const [cat, setCat] = useState<CategoryId>("ativos");
  const [period, setPeriod] = useState("1mo");
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");

  const active = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];

  const { rows, updatedAt } = useMemo(
    () => rowsFor(cat, period, currency, props),
    [cat, period, currency, props],
  );
  const sorted = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows]);
  const height = Math.max(220, 26 * sorted.length + 52);

  return (
    <section className="flex w-full min-w-0 flex-col rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#132960] md:text-lg">Mercados — retornos (%)</h2>
        <div className="flex flex-wrap items-center gap-2">
          {active.currencyToggle ? (
            <AzSegmented
              ariaLabel="Moeda"
              value={currency}
              onChange={(v) => setCurrency(v as "brl" | "usd")}
              options={[
                { id: "brl", label: "BRL" },
                { id: "usd", label: "USD" },
              ]}
            />
          ) : null}
          <AzSegmented ariaLabel="Período" value={period} onChange={setPeriod} options={PERIODS} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-0.5 border-b border-zinc-100">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            aria-pressed={cat === c.id}
            className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors duration-150 md:text-sm ${
              cat === c.id
                ? "border-[#027DFC] text-[#027DFC]"
                : "border-transparent text-zinc-500 hover:text-[#132960]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Sem dados para este período.</p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              layout="vertical"
              barCategoryGap="35%"
              margin={{ left: 4, right: 48, top: 8, bottom: 4 }}
            >
              <CartesianGrid stroke={AZ_CHART.grid} strokeWidth={1} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: AZ_CHART.ticks }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                tickCount={5}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={158}
                tick={<FlagYTick />}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <ReferenceLine x={0} stroke={AZ_CHART.zero} strokeOpacity={0.55} strokeWidth={1.5} />
              <Tooltip
                cursor={{ fill: "rgba(19,41,96,0.05)" }}
                contentStyle={{
                  background: AZ_CHART.zero,
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(19,41,96,.25)",
                }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#94A3B8", fontWeight: 600 }}
                labelFormatter={(label) => splitFlagName(String(label)).label}
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—", "Retorno"];
                }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {sorted.map((e) => (
                  <Cell key={e.name} fill={e.value >= 0 ? AZ_CHART.pos : AZ_CHART.neg} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return "";
                    return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
                  }}
                  style={{ fontSize: 10.5, fill: "#475569", fontVariantNumeric: "tabular-nums" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {updatedAt ? (
        <p className="mt-auto pt-2 text-right">
          {/* Fonte intradiária (cron 15min): generated_at carrega os minutos do dado. */}
          <DataStamp giro={updatedAt} dado={updatedAt} />
        </p>
      ) : null}
    </section>
  );
}
