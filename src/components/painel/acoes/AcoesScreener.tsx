"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { AcoesScreenerData, AcoesScreenerRow } from "@/lib/painel-acoes";

type SortKey =
  | "name"
  | "sector"
  | "price"
  | "pl"
  | "pvp"
  | "dy_12m_pct"
  | "roe_pct"
  | "market_cap"
  | "ibov_weight_pct";
type SortDir = "asc" | "desc";

const COL_LABELS: Record<SortKey, string> = {
  name: "Nome",
  sector: "Setor",
  price: "Preço",
  pl: "P/L",
  pvp: "P/VP",
  dy_12m_pct: "D.Y",
  roe_pct: "ROE",
  market_cap: "Valor mcdo.",
  ibov_weight_pct: "Peso IBOV",
};

const NUMERIC: SortKey[] = ["price", "pl", "pvp", "dy_12m_pct", "roe_pct", "market_cap", "ibov_weight_pct"];

function fmtBRL(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRatio(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(2);
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)}%`;
}
function fmtBig(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `R$ ${(v / 1e12).toFixed(2)} tri`;
  if (abs >= 1e9) return `R$ ${(v / 1e9).toFixed(1)} bi`;
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(0)} mi`;
  return `R$ ${v.toFixed(0)}`;
}

function compareRow(a: AcoesScreenerRow, b: AcoesScreenerRow, key: SortKey, dir: SortDir): number {
  const va = (a[key] ?? null) as number | string | null;
  const vb = (b[key] ?? null) as number | string | null;
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const sign = dir === "asc" ? 1 : -1;
  if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "pt-BR") * sign;
  return ((va as number) - (vb as number)) * sign;
}

type Props = {
  data: AcoesScreenerData;
};

export function AcoesScreener({ data }: Props) {
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("Todos");
  const [sortKey, setSortKey] = useState<SortKey>("ibov_weight_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q && !(r.ticker + " " + r.name).toLowerCase().includes(q)) return false;
      if (sectorFilter !== "Todos" && r.sector !== sectorFilter) return false;
      return true;
    });
  }, [data, query, sectorFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => compareRow(a, b, sortKey, sortDir));
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "sector" ? "asc" : "desc");
    }
  }

  const cols: SortKey[] = ["name", "sector", "price", "pl", "pvp", "dy_12m_pct", "roe_pct", "market_cap", "ibov_weight_pct"];

  return (
    <section
      aria-label="Screener de ações do Ibovespa"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <div className="flex items-center gap-2 rounded-full border border-[#132960]/15 bg-zinc-50 px-3 py-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-500">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar ticker ou nome"
            className="w-44 border-0 bg-transparent text-xs text-[#132960] placeholder:text-zinc-400 focus:outline-none md:w-56"
          />
        </div>

        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Setor
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="rounded-md border border-[#132960]/15 bg-white px-2 py-1 text-[11px] font-normal text-[#132960] focus:outline-none"
          >
            <option value="Todos">Todos</option>
            {data.sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-[11px] text-zinc-500">
          {sorted.length} de {data.total_rows} ações
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#132960]/10 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {cols.map((k) => {
                const isActive = k === sortKey;
                const isNum = NUMERIC.includes(k);
                return (
                  <th key={k} scope="col" className={`px-2 py-2 ${isNum ? "text-right" : "text-left"}`}>
                    <button
                      type="button"
                      onClick={() => toggleSort(k)}
                      className={`inline-flex items-center gap-1 transition hover:text-[#132960] ${isActive ? "text-[#132960]" : ""}`}
                    >
                      {COL_LABELS[k]}
                      <span aria-hidden className="text-[8px]">
                        {isActive ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-2 py-6 text-center text-zinc-400">
                  Nenhuma ação encontrada com esses filtros.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.ticker} className="border-b border-zinc-100 transition hover:bg-zinc-50/60">
                  <td className="px-2 py-2">
                    <Link
                      href={`/painel-economico/mercado/ativo/${r.ticker.toLowerCase()}`}
                      className="block font-semibold tabular-nums text-[#132960] transition hover:text-[#027DFC] hover:underline"
                    >
                      {r.ticker}
                    </Link>
                    <span className="block max-w-[160px] truncate text-[10px] text-zinc-500" title={r.name}>
                      {r.name}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-zinc-600">{r.sector}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    {fmtBRL(r.price)}
                    {r.change_pct_1d != null ? (
                      <span className={`block text-[10px] ${r.change_pct_1d >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {r.change_pct_1d >= 0 ? "▲" : "▼"} {Math.abs(r.change_pct_1d).toFixed(2)}%
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    <span
                      title={r.pl_warning ? "Lucro negativo ou múltiplo atípico — interpretar com cautela." : undefined}
                      className={r.pl_warning ? "cursor-help text-amber-700" : undefined}
                    >
                      {fmtRatio(r.pl)}
                      {r.pl_warning ? "*" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">{fmtRatio(r.pvp)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    <span
                      title={r.dy_atypical ? "DY > 15% — pode incluir proventos extraordinários." : undefined}
                      className={r.dy_atypical ? "cursor-help text-amber-700" : undefined}
                    >
                      {fmtPct(r.dy_12m_pct)}
                      {r.dy_atypical ? "*" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">{fmtPct(r.roe_pct)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">{fmtBig(r.market_cap)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-600">
                    {r.ibov_weight_pct != null ? `${r.ibov_weight_pct.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-zinc-400">
        Universo: carteira teórica do Ibovespa (B3 <code>GetPortfolioDay</code>). P/L, P/VP, DY, ROE e
        valor de mercado via yfinance (<code>.info</code>); preço via yfinance. Setor por catálogo
        curado. <strong>*</strong> P/L de empresa com lucro negativo/atípico ou DY com proventos
        extraordinários. Não é recomendação.
      </p>
    </section>
  );
}
