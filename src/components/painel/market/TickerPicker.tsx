"use client";

import { useMemo, useState } from "react";

import type { CatalogAsset } from "@/lib/painel-market-data";
import { classLabel } from "@/lib/painel-market-data";

type Props = {
  catalog: CatalogAsset[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
};

/**
 * Autocomplete simples: digita "Petr" e mostra sugestoes do catalogo.
 * Chips clicaveis para remover. Limita N tickers simultaneos.
 */
export function TickerPicker({ catalog, selected, onChange, max = 8 }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const tickerToAsset = useMemo(() => {
    const m: Record<string, CatalogAsset> = {};
    for (const a of catalog) m[a.ticker] = a;
    return m;
  }, [catalog]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const items = catalog.filter(
      (a) =>
        !selected.includes(a.ticker) &&
        (a.ticker.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.sector.toLowerCase().includes(q)),
    );
    return items.slice(0, 12);
  }, [catalog, query, selected]);

  function add(ticker: string) {
    if (selected.includes(ticker)) return;
    if (selected.length >= max) return;
    onChange([...selected, ticker]);
    setQuery("");
  }

  function remove(ticker: string) {
    onChange(selected.filter((t) => t !== ticker));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((t) => {
          const a = tickerToAsset[t];
          return (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-[#ebf4ff] px-2.5 py-1 text-xs font-medium text-[#027DFC]"
            >
              <span className="font-semibold">{a?.name ?? t}</span>
              <span className="rounded bg-white/70 px-1 text-[10px] uppercase text-[#132960]">
                {a ? classLabel(a.klass) : ""}
              </span>
              <button
                type="button"
                onClick={() => remove(t)}
                aria-label={`Remover ${t}`}
                className="ml-1 text-[#132960] hover:text-[#dc2626]"
              >
                ×
              </button>
            </span>
          );
        })}
        {selected.length === 0 ? (
          <span className="text-xs italic text-zinc-500">Nenhum ativo selecionado.</span>
        ) : null}
      </div>

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={selected.length >= max ? `Limite de ${max} atingido` : "Adicionar ativo (ex.: Petrobras, AAPL, ouro)..."}
          disabled={selected.length >= max}
          className="w-full rounded-lg border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] placeholder:text-zinc-400 focus:border-[#027DFC] focus:outline-none focus:ring-2 focus:ring-[#027DFC]/30 disabled:bg-zinc-50 disabled:text-zinc-400"
        />
        {focused && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-[#132960]/15 bg-white shadow-lg">
            {suggestions.map((a) => (
              <li key={a.ticker}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(a.ticker);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-[#ebf4ff]"
                >
                  <span className="truncate font-semibold text-[#132960]">{a.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-zinc-500">
                    <span className="font-mono">{a.ticker}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 uppercase">{classLabel(a.klass)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
