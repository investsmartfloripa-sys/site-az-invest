"use client";

import { useState } from "react";

import DataStamp from "@/components/painel/DataStamp";
import { AzSegmented } from "@/components/painel/panorama/AzSegmented";
import type { SectorBrPayload } from "@/components/painel/DynamicSectorBr";
import type { SectorGlobalPayload } from "@/components/painel/DynamicSectorGlobal";

type BasketRow = { basket_name?: string; return_pct?: number };

type ScopeId = "brasil" | "global";

const POS_TEXT = "#166B47";
const NEG_TEXT = "#9C2B24";
const POS_BG = "rgba(30,138,92,0.10)";
const NEG_BG = "rgba(190,59,51,0.10)";

const PERIODS = [
  { id: "1d", label: "1D" },
  { id: "1wk", label: "1S" },
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "1y", label: "1A" },
];

function RankCol({ title, dotColor, rows }: { title: string; dotColor: string; rows: BasketRow[] }) {
  const maxAbs = Math.max(0.0001, ...rows.map((r) => Math.abs(Number(r.return_pct ?? 0))));
  return (
    <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
        {title}
      </h3>
      <ul className="space-y-1">
        {rows.map((r, i) => {
          const name = r.basket_name ?? "—";
          const pct = Number(r.return_pct ?? 0);
          const neg = pct < 0;
          const widthPct = Math.min(100, (Math.abs(pct) / maxAbs) * 100);
          return (
            <li key={`${name}-${i}`} className="relative overflow-hidden rounded-md">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0"
                style={{ width: `${widthPct}%`, backgroundColor: neg ? NEG_BG : POS_BG }}
              />
              <span className="relative flex items-center justify-between gap-2 px-1.5 py-1.5 text-sm">
                <span className="truncate text-[#132960]">{name}</span>
                <span
                  className="shrink-0 font-semibold tabular-nums"
                  style={{ color: neg ? NEG_TEXT : POS_TEXT }}
                >
                  {pct > 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Props = {
  sectorBr: SectorBrPayload | null;
  sectorGlobal: SectorGlobalPayload | null;
};

/**
 * Card unificado de setores (Brasil | Global) em formato ranking
 * com mini-barra de fundo proporcional (padrao "table with bars").
 */
export function SectorsPanel({ sectorBr, sectorGlobal }: Props) {
  const [scope, setScope] = useState<ScopeId>("brasil");
  const [period, setPeriod] = useState("1mo");
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");

  let top: BasketRow[] = [];
  let bottom: BasketRow[] = [];
  let updatedAt: string | undefined;

  if (scope === "brasil") {
    const inner = sectorBr?.by_period?.[period]?.data;
    top = inner?.top10 ?? [];
    bottom = inner?.bottom10 ?? [];
    updatedAt = sectorBr?.generated_at;
  } else {
    const block = sectorGlobal?.by_period?.[period];
    const view = currency === "brl" ? block?.view_brl : block?.view_usd;
    top = view?.top10 ?? [];
    bottom = view?.bottom10 ?? [];
    updatedAt = sectorGlobal?.generated_at;
  }

  return (
    <section className="flex w-full min-w-0 flex-col rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#132960] md:text-lg">Setores — top / bottom</h2>
        <div className="flex flex-wrap items-center gap-2">
          {scope === "global" ? (
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
        {(
          [
            { id: "brasil", label: "Brasil" },
            { id: "global", label: "Global" },
          ] as { id: ScopeId; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            aria-pressed={scope === s.id}
            className={`rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors duration-150 md:text-sm ${
              scope === s.id
                ? "border-[#027DFC] text-[#027DFC]"
                : "border-transparent text-zinc-500 hover:text-[#132960]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {top.length === 0 && bottom.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Sem dados de setores.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <RankCol title="Top 10" dotColor="#1E8A5C" rows={top} />
          <RankCol title="Bottom 10" dotColor="#BE3B33" rows={bottom} />
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
