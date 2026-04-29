"use client";

import { useState } from "react";

import { CurrencyToggle } from "./CurrencyToggle";
import { formatUpdatedAt } from "./formatUpdatedAt";
import { PeriodSelector } from "./PeriodSelector";

type BasketRow = {
  basket_name?: string;
  return_pct?: number;
};

type View = { top10?: BasketRow[]; bottom10?: BasketRow[] };

export type SectorGlobalPayload = {
  generated_at?: string;
  by_period?: Record<
    string,
    {
      view_brl?: View;
      view_usd?: View;
    }
  >;
};

function SectorCol({ title, rows }: { title: string; rows: BasketRow[] }) {
  return (
    <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="space-y-1">
        {rows.map((r, i) => {
          const name = r.basket_name ?? "—";
          const pct = Number(r.return_pct ?? 0);
          const neg = pct < 0;
          return (
            <li
              key={`${name}-${i}`}
              className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 text-sm last:border-0"
            >
              <span className="truncate text-[#132960]">{name}</span>
              <span className={`shrink-0 font-medium tabular-nums ${neg ? "text-[#E74C3C]" : "text-[#2ECC71]"}`}>
                {pct.toFixed(2)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Props = {
  title: string;
  data: SectorGlobalPayload | null;
  updatedAt?: string;
};

export function DynamicSectorGlobal({ title, data, updatedAt }: Props) {
  const [period, setPeriod] = useState("1mo");
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");

  const block = data?.by_period?.[period];
  const view = currency === "brl" ? block?.view_brl : block?.view_usd;
  const top10 = view?.top10 ?? [];
  const bottom10 = view?.bottom10 ?? [];
  const formattedUpdatedAt = formatUpdatedAt(updatedAt);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#027DFC]">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <CurrencyToggle value={currency} onChange={setCurrency} />
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>
      {top10.length === 0 && bottom10.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Sem dados de setores.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <SectorCol title="Top 10" rows={top10} />
          <SectorCol title="Bottom 10" rows={bottom10} />
        </div>
      )}
      {formattedUpdatedAt ? (
        <p className="mt-2 text-xs italic text-zinc-700">Panorama - atualizado em {formattedUpdatedAt}</p>
      ) : null}
    </div>
  );
}
