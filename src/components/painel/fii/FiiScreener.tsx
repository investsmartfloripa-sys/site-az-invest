"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import DataStamp from "@/components/painel/DataStamp";
import type { FiiScreenerData, FiiScreenerRow } from "@/lib/painel-fii";

type SortKey = "name" | "segment" | "price" | "dy_12m_pct" | "pvp" | "pl" | "liquidity_avg_21d";
type SortDir = "asc" | "desc";

const COL_LABELS: Record<SortKey, string> = {
  name: "Nome",
  segment: "Setor",
  price: "Preço",
  dy_12m_pct: "D.Y",
  pvp: "P/VP",
  pl: "PL",
  liquidity_avg_21d: "Liquidez",
};

function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}
function formatBig(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `R$ ${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `R$ ${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `R$ ${(value / 1e3).toFixed(0)}K`;
  return `R$ ${value.toFixed(0)}`;
}
function formatRatio(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(3);
}

function compareRow(a: FiiScreenerRow, b: FiiScreenerRow, key: SortKey, dir: SortDir): number {
  const va = (a[key] ?? null) as number | string | null;
  const vb = (b[key] ?? null) as number | string | null;
  // Nulls vão pro fim sempre
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const sign = dir === "asc" ? 1 : -1;
  if (typeof va === "string" && typeof vb === "string") {
    return va.localeCompare(vb, "pt-BR") * sign;
  }
  return ((va as number) - (vb as number)) * sign;
}

type Props = {
  data: FiiScreenerData;
};

export function FiiScreener({ data }: Props) {
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("Todos");
  const [sortKey, setSortKey] = useState<SortKey>("liquidity_avg_21d");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q) {
        const hay = (r.ticker + " " + r.name).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (segmentFilter !== "Todos" && r.segment !== segmentFilter) return false;
      return true;
    });
  }, [data, query, segmentFilter]);

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
      // Strings default asc, números default desc
      setSortDir(key === "name" || key === "segment" ? "asc" : "desc");
    }
  }

  return (
    <section
      aria-label="Screener de FIIs"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      {/* Toolbar filtros */}
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <div className="flex items-center gap-2 rounded-full border border-[#132960]/15 bg-zinc-50 px-3 py-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5 text-zinc-500"
          >
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
          Setores
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="rounded-md border border-[#132960]/15 bg-white px-2 py-1 text-[11px] font-normal text-[#132960] focus:outline-none"
          >
            <option value="Todos">Todos</option>
            {data.segments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-[11px] text-zinc-500">
          {sorted.length} de {data.total_rows} FIIs
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#132960]/10 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {(["name", "segment", "price", "dy_12m_pct", "pvp", "pl", "liquidity_avg_21d"] as SortKey[]).map(
                (k) => {
                  const isActive = k === sortKey;
                  const isNumeric = k !== "name" && k !== "segment";
                  return (
                    <th
                      key={k}
                      scope="col"
                      className={`px-2 py-2 ${isNumeric ? "text-right" : "text-left"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(k)}
                        className={`inline-flex items-center gap-1 transition hover:text-[#132960] ${
                          isActive ? "text-[#132960]" : ""
                        }`}
                      >
                        {COL_LABELS[k]}
                        <span aria-hidden className="text-[8px]">
                          {isActive ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                },
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-zinc-400">
                  Nenhum FII encontrado com esses filtros.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-b border-zinc-100 transition hover:bg-zinc-50/60"
                >
                  <td className="px-2 py-2">
                    <Link
                      href={`/painel-economico/mercado/brasil/fundos-imobiliarios/${r.ticker.toLowerCase()}`}
                      className="block font-semibold tabular-nums text-[#132960] transition hover:text-[#027DFC] hover:underline"
                    >
                      {r.ticker}
                    </Link>
                    <span className="block truncate text-[10px] text-zinc-500" title={r.name}>
                      {r.name}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-zinc-600">{r.segment}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    {r.price != null ? `R$ ${formatBRL(r.price)}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    <span
                      title={
                        r.dy_atypical
                          ? "DY > 18% pode incluir amortização de capital. Verifique o relatório gerencial do fundo."
                          : undefined
                      }
                      className={r.dy_atypical ? "cursor-help text-amber-700" : undefined}
                    >
                      {formatPct(r.dy_12m_pct)}
                      {r.dy_atypical ? "*" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    <span
                      title={
                        r.pvp_warning
                          ? "P/VP < 0,7 pode indicar distress (vacância alta, problema de crédito da carteira). Verifique relatório gerencial."
                          : r.pvp == null
                          ? "Escala de Valor Patrimonial reportada pela CVM inconsistente — fora."
                          : undefined
                      }
                      className={r.pvp_warning ? "cursor-help text-amber-700" : r.pvp == null ? "cursor-help" : undefined}
                    >
                      {formatRatio(r.pvp)}
                      {r.pvp_warning ? "*" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    {formatBig(r.pl)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#132960]">
                    {formatBig(r.liquidity_avg_21d)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-zinc-400">
        Universo: composição IFIX ({data.total_in_ifix} FIIs). Preço, dividendos e liquidez via
        yfinance; PL e VP/cota via CVM Informe Mensal. Segmento por catálogo curado (gestoras).
        Outliers de P/VP (escala não padronizada na CVM) ficam como “—”. <strong>*</strong>{" "}
        DY &gt; 18% pode incluir amortização — não é renda recorrente.
      </p>
      <p className="mt-2 text-right">
        <DataStamp giro={data.generated_at} dado={data.generated_at} />
      </p>
    </section>
  );
}
