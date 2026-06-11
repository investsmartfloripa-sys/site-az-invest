"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { AssetClass, CatalogAsset, MarketHistoryLatest, ReturnPeriods } from "@/lib/painel-market-data";
import { classLabel } from "@/lib/painel-market-data";
import { MarketCard } from "@/components/painel/market/MarketCard";
import { variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";

type Props = {
  catalog: CatalogAsset[];
  latest: MarketHistoryLatest | null;
};

type SortKey = "name" | "sector" | "last" | "1d" | "1w" | "1m" | "3m" | "ytd" | "1y" | "5y";

const PERIOD_COLS: Array<{ key: keyof ReturnPeriods; label: string }> = [
  { key: "1d",  label: "1D" },
  { key: "1w",  label: "1S" },
  { key: "1m",  label: "1M" },
  { key: "3m",  label: "3M" },
  { key: "ytd", label: "YTD" },
  { key: "1y",  label: "1A" },
  { key: "5y",  label: "5A" },
];


export function MarketOverviewTable({ catalog, latest }: Props) {
  const [klassFilter, setKlassFilter] = useState<AssetClass | "all">("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("1m");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const tickers = latest?.tickers ?? {};
    return catalog.map((a) => ({
      asset: a,
      latest: tickers[a.ticker] ?? null,
    }));
  }, [catalog, latest]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (klassFilter !== "all" && r.asset.klass !== klassFilter) return false;
      if (q && !(r.asset.name.toLowerCase().includes(q) || r.asset.sector.toLowerCase().includes(q) || r.asset.ticker.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, klassFilter, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortBy === "name") {
        return sortDir === "asc"
          ? a.asset.name.localeCompare(b.asset.name, "pt-BR")
          : b.asset.name.localeCompare(a.asset.name, "pt-BR");
      }
      if (sortBy === "sector") {
        return sortDir === "asc"
          ? a.asset.sector.localeCompare(b.asset.sector, "pt-BR")
          : b.asset.sector.localeCompare(a.asset.sector, "pt-BR");
      }
      if (sortBy === "last") {
        const av = a.latest?.last_close ?? null;
        const bv = b.latest?.last_close ?? null;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const av = a.latest?.returns[sortBy] ?? null;
      const bv = b.latest?.returns[sortBy] ?? null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  const klassOptions: Array<{ id: AssetClass | "all"; label: string }> = [
    { id: "all", label: "Tudo" },
    { id: "br_acoes", label: "Ações BR" },
    { id: "br_etf", label: "ETFs BR" },
    { id: "br_fii", label: "FIIs" },
    { id: "us_acoes", label: "Ações EUA" },
    { id: "us_etf", label: "ETFs EUA" },
    { id: "indice", label: "Índices" },
    { id: "fx", label: "Câmbio" },
    { id: "commodity", label: "Commodities" },
    { id: "cripto", label: "Cripto" },
  ];

  return (
    <MarketCard
      title="Retornos por classe"
      subtitle="Performance de cada ativo em janelas de 1 dia a 5 anos."
      badge={latest ? `${latest.total_tickers_loaded} ativos` : undefined}
      bodyClassName="px-4 pb-4 pt-2"
      footer="Fonte: Yahoo Finance"
      stampGiro={latest?.generated_at ?? null}
      stampDado={latest?.generated_at ?? null}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-[#132960]/20 bg-white px-3 py-1.5 text-sm focus:border-[#027DFC] focus:outline-none focus:ring-2 focus:ring-[#027DFC]/30"
          />
          <div className="flex flex-wrap gap-1">
            {klassOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setKlassFilter(o.id)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  klassFilter === o.id
                    ? "bg-[#132960] text-white"
                    : "border border-[#132960]/20 bg-white text-[#132960] hover:border-[#027DFC] hover:text-[#027DFC]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#132960]/10">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th
                  onClick={() => toggleSort("name")}
                  className="cursor-pointer select-none px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100"
                >
                  Ativo {sortBy === "name" ? <span className="text-[#027DFC]">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                </th>
                <th
                  onClick={() => toggleSort("sector")}
                  className="cursor-pointer select-none px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100"
                >
                  Setor {sortBy === "sector" ? <span className="text-[#027DFC]">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                </th>
                <th
                  onClick={() => toggleSort("last")}
                  className="cursor-pointer select-none px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100"
                >
                  Cotação {sortBy === "last" ? <span className="text-[#027DFC]">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                </th>
                {PERIOD_COLS.map((p) => (
                  <th
                    key={p.key}
                    onClick={() => toggleSort(p.key as SortKey)}
                    className="cursor-pointer select-none px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100"
                  >
                    {p.label}{" "}
                    {sortBy === p.key ? <span className="text-[#027DFC]">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map(({ asset, latest: row }, idx) => (
                <tr
                  key={asset.ticker}
                  className={`tabular-nums ${idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40"} hover:bg-[#ebf4ff]`}
                >
                  <td className="px-2 py-1.5">
                    <Link
                      href={`/painel-economico/mercado/ativo/${encodeURIComponent(asset.ticker)}`}
                      className="block"
                    >
                      <span className="block font-semibold text-[#132960] hover:text-[#027DFC]">{asset.name}</span>
                      <span className="block text-[10px] uppercase text-zinc-500">
                        {asset.ticker} · {classLabel(asset.klass)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-zinc-700">{asset.sector}</td>
                  <td className="px-2 py-1.5 text-right text-[#132960]">
                    {row?.last_close != null ? (
                      <span>
                        {asset.currency === "BRL" ? "R$ " : "US$ "}
                        {row.last_close.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {PERIOD_COLS.map((p) => {
                    const v = row?.returns[p.key];
                    return (
                      <td
                        key={p.key}
                        className={`px-2 py-1.5 text-right font-semibold ${v == null ? "text-zinc-400" : ""}`}
                        style={v != null ? { color: variationText(v) } : undefined}
                      >
                        {fmtSignedPct(v, 2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={3 + PERIOD_COLS.length} className="px-2 py-8 text-center text-zinc-500">
                    Nenhum ativo bate os filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </MarketCard>
  );
}
