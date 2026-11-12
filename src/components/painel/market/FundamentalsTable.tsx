"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { AssetClass, MarketFundamentals, TickerFundamentals } from "@/lib/painel-market-data";
import {
  classLabel,
  formatBigNumber,
  formatPctFromRatio,
  formatRatio,
} from "@/lib/painel-market-data";
import { MarketCard } from "@/components/painel/market/MarketCard";

const COLUMNS = [
  { key: "ticker",     label: "Ativo",       align: "left",  sortable: true,  width: "min-w-[180px]" },
  { key: "sector",     label: "Setor",       align: "left",  sortable: true,  width: "min-w-[120px]" },
  { key: "marketCap",  label: "Market Cap",  align: "right", sortable: true,  width: "min-w-[110px]" },
  { key: "trailingPE", label: "P/L",         align: "right", sortable: true,  width: "min-w-[70px]" },
  { key: "forwardPE",  label: "P/L fwd",     align: "right", sortable: true,  width: "min-w-[70px]" },
  { key: "priceToBook",label: "P/VP",        align: "right", sortable: true,  width: "min-w-[70px]" },
  { key: "evEbitda",   label: "EV/EBITDA",   align: "right", sortable: true,  width: "min-w-[90px]" },
  { key: "divYield",   label: "DY",          align: "right", sortable: true,  width: "min-w-[70px]" },
  { key: "roe",        label: "ROE",         align: "right", sortable: true,  width: "min-w-[70px]" },
  { key: "margin",     label: "Marg. Op.",   align: "right", sortable: true,  width: "min-w-[80px]" },
  { key: "debtEq",     label: "Div/PL",      align: "right", sortable: true,  width: "min-w-[70px]" },
  { key: "beta",       label: "Beta",        align: "right", sortable: true,  width: "min-w-[60px]" },
] as const;

type SortKey = (typeof COLUMNS)[number]["key"];

/** Classes sem múltiplos de empresa (índice, câmbio, commodity, cripto): fora desta tabela. */
const SEM_FUNDAMENTOS: ReadonlySet<AssetClass> = new Set<AssetClass>(["indice", "fx", "commodity", "cripto"]);

/**
 * Faixa plausível de cada múltiplo. Fora dela o número existe na fonte mas não tem leitura
 * (P/VP −4.046 de um ETF de títulos, Div/PL de 13× com patrimônio quase zerado...): a célula
 * mostra "n/s*" com o valor bruto no tooltip, e a ordenação o trata como vazio.
 */
const FAIXA: Partial<Record<SortKey, [number, number]>> = {
  trailingPE: [0, 200],
  forwardPE: [0, 200],
  priceToBook: [0, 50],
  evEbitda: [0, 100],
  divYield: [0, 0.25],
  roe: [-1, 1],
  margin: [-1, 1],
  debtEq: [0, 1000], // a fonte dá Div/PL em %: 1.000% = 10×
};

function atipico(key: SortKey, v: number | string | null): boolean {
  const faixa = FAIXA[key];
  return faixa != null && typeof v === "number" && (v < faixa[0] || v > faixa[1]);
}

type Filters = {
  klass: AssetClass | "all";
  query: string;
  minPE: string;
  maxPE: string;
  minDY: string;
  minROE: string;
};

type Props = {
  data: MarketFundamentals | null;
};

type TickerRow = TickerFundamentals & { ticker: string };

function getField(t: TickerRow, key: SortKey): number | string | null {
  const info = t.info;
  switch (key) {
    case "ticker":     return t.name;
    case "sector":     return t.sector;
    case "marketCap":  return info.marketCap ?? null;
    case "trailingPE": return info.trailingPE ?? null;
    case "forwardPE":  return info.forwardPE ?? null;
    case "priceToBook":return info.priceToBook ?? null;
    case "evEbitda":   return info.enterpriseToEbitda ?? null;
    case "divYield":   return info.dividendYield ?? info.trailingAnnualDividendYield ?? null;
    case "roe":        return info.returnOnEquity ?? null;
    case "margin":     return info.operatingMargins ?? null;
    case "debtEq":     return info.debtToEquity ?? null; // em % na fonte (150 = 1,5×)
    case "beta":       return info.beta ?? null;
  }
}

function renderCell(t: TickerRow, key: SortKey) {
  const info = t.info;
  const bruto = getField(t, key);
  if (atipico(key, bruto)) {
    const txt = key === "debtEq" ? formatRatio((bruto as number) / 100) : FMT_PCT.has(key) ? formatPctFromRatio(bruto as number) : formatRatio(bruto as number);
    return (
      <span className="cursor-help text-zinc-500" title={`Valor atípico na fonte (${txt}): sem leitura útil, fica fora da ordenação.`}>
        n/s*
      </span>
    );
  }
  switch (key) {
    case "ticker":
      return (
        <Link href={`/painel-economico/mercado/ativo/${encodeURIComponent(t.ticker)}`} className="block min-w-0">
          <span className="block truncate font-semibold text-[#132960] hover:text-[#027DFC]">
            {t.name}
          </span>
          <span className="block text-[10px] uppercase text-zinc-500">{classLabel(t.klass)}</span>
        </Link>
      );
    case "sector":
      return <span className="text-zinc-700">{t.sector}</span>;
    case "marketCap":
      return formatBigNumber(info.marketCap, t.currency);
    case "trailingPE":
      return formatRatio(info.trailingPE);
    case "forwardPE":
      return formatRatio(info.forwardPE);
    case "priceToBook":
      return formatRatio(info.priceToBook);
    case "evEbitda":
      return formatRatio(info.enterpriseToEbitda);
    case "divYield":
      return formatPctFromRatio(info.dividendYield ?? info.trailingAnnualDividendYield);
    case "roe":
      return formatPctFromRatio(info.returnOnEquity);
    case "margin":
      return formatPctFromRatio(info.operatingMargins);
    case "debtEq":
      // A fonte entrega Div/PL em %; a coluna mostra em vezes (1,5 = dívida de 1,5× o patrimônio).
      return info.debtToEquity == null ? "—" : formatRatio(info.debtToEquity / 100);
    case "beta":
      return formatRatio(info.beta);
  }
}

const FMT_PCT: ReadonlySet<SortKey> = new Set<SortKey>(["divYield", "roe", "margin"]);
const CAMPOS_MULTIPLO: SortKey[] = ["trailingPE", "forwardPE", "priceToBook", "evEbitda", "divYield", "roe", "margin", "debtEq"];

export function FundamentalsTable({ data }: Props) {
  const [filters, setFilters] = useState<Filters>({
    klass: "all",
    query: "",
    minPE: "",
    maxPE: "",
    minDY: "",
    minROE: "",
  });
  const [sortBy, setSortBy] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Só ativos com múltiplos: índices, câmbio, commodities e cripto (e ETFs sem nenhum número)
  // eram ~70 linhas inteiras de "—" (revisão de 12/11/2026).
  const { rows, semMultiplos } = useMemo(() => {
    if (!data) return { rows: [] as TickerRow[], semMultiplos: 0 };
    const todos = Object.entries(data.tickers).map(([ticker, v]) => ({ ...v, ticker }));
    const com = todos.filter(
      (r) => !SEM_FUNDAMENTOS.has(r.klass) && CAMPOS_MULTIPLO.some((k) => getField(r, k) != null),
    );
    return { rows: com, semMultiplos: todos.length - com.length };
  }, [data]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const minPE = filters.minPE ? Number(filters.minPE) : null;
    const maxPE = filters.maxPE ? Number(filters.maxPE) : null;
    const minDY = filters.minDY ? Number(filters.minDY) / 100 : null;
    const minROE = filters.minROE ? Number(filters.minROE) / 100 : null;

    return rows.filter((r) => {
      if (filters.klass !== "all" && r.klass !== filters.klass) return false;
      if (q && !(r.name.toLowerCase().includes(q) || r.sector.toLowerCase().includes(q))) return false;
      const pe = r.info.trailingPE;
      if (minPE != null && (pe == null || pe < minPE)) return false;
      if (maxPE != null && (pe == null || pe > maxPE)) return false;
      const dy = r.info.dividendYield ?? r.info.trailingAnnualDividendYield;
      if (minDY != null && (dy == null || dy < minDY)) return false;
      const roe = r.info.returnOnEquity;
      if (minROE != null && (roe == null || roe < minROE)) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ra = getField(a, sortBy);
      const rb = getField(b, sortBy);
      const va = atipico(sortBy, ra) ? null : ra;
      const vb = atipico(sortBy, rb) ? null : rb;
      const aIsNull = va == null;
      const bIsNull = vb == null;
      if (aIsNull && bIsNull) return 0;
      if (aIsNull) return 1; // nulos sempre no fim
      if (bIsNull) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb), "pt-BR")
        : String(vb).localeCompare(String(va), "pt-BR");
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
  ];

  return (
    <MarketCard
      title="Screener"
      subtitle={
        data
          ? `${sorted.length} de ${rows.length} ativos com múltiplos${
              semMultiplos ? ` · ${semMultiplos} sem múltiplos (índices, câmbio, commodities, cripto) ficam de fora` : ""
            }`
          : "Múltiplos de ações e ETFs, segundo o Yahoo Finance."
      }
      badge="Yahoo Finance"
      bodyClassName="px-4 pb-4 pt-2"
      footer={
        <>
          Fonte: Yahoo Finance. Múltiplos atuais (últimos 12 meses). DY, ROE e margem operacional em
          %; Div/PL em vezes. “—”: a fonte não informou o múltiplo. “n/s*”: valor atípico na fonte
          (patrimônio negativo ou quase zero, por exemplo), sem leitura útil; o número bruto aparece
          ao passar o mouse.
        </>
      }
      stampGiro={data?.generated_at ?? null}
      stampDado={data?.generated_at ?? null}
    >
      {!data ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Os múltiplos ainda não foram carregados. Volte em alguns minutos.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]">
            <input
              type="search"
              placeholder="Buscar por nome ou setor..."
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              className="rounded-lg border border-[#132960]/20 bg-white px-3 py-1.5 text-sm focus:border-[#027DFC] focus:outline-none focus:ring-2 focus:ring-[#027DFC]/30"
            />
            <select
              value={filters.klass}
              onChange={(e) => setFilters({ ...filters, klass: e.target.value as AssetClass | "all" })}
              className="rounded-lg border border-[#132960]/20 bg-white px-3 py-1.5 text-sm text-[#132960] focus:border-[#027DFC] focus:outline-none"
            >
              {klassOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="P/L min"
              value={filters.minPE}
              onChange={(e) => setFilters({ ...filters, minPE: e.target.value })}
              className="rounded-lg border border-[#132960]/20 bg-white px-2 py-1.5 text-sm tabular-nums"
            />
            <input
              type="number"
              placeholder="P/L max"
              value={filters.maxPE}
              onChange={(e) => setFilters({ ...filters, maxPE: e.target.value })}
              className="rounded-lg border border-[#132960]/20 bg-white px-2 py-1.5 text-sm tabular-nums"
            />
            <input
              type="number"
              placeholder="DY% min"
              value={filters.minDY}
              onChange={(e) => setFilters({ ...filters, minDY: e.target.value })}
              className="rounded-lg border border-[#132960]/20 bg-white px-2 py-1.5 text-sm tabular-nums"
            />
            <input
              type="number"
              placeholder="ROE% min"
              value={filters.minROE}
              onChange={(e) => setFilters({ ...filters, minROE: e.target.value })}
              className="rounded-lg border border-[#132960]/20 bg-white px-2 py-1.5 text-sm tabular-nums"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#132960]/10">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && toggleSort(col.key as SortKey)}
                      className={`px-2 py-2 ${col.align === "right" ? "text-right" : "text-left"} ${
                        col.sortable ? "cursor-pointer select-none hover:bg-zinc-100" : ""
                      } ${col.width} text-[11px] font-semibold uppercase tracking-wide text-zinc-600`}
                    >
                      {col.label}
                      {sortBy === col.key ? (
                        <span className="ml-1 text-[#027DFC]">{sortDir === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sorted.map((row, idx) => (
                  <tr
                    key={row.ticker}
                    className={`tabular-nums ${idx % 2 === 0 ? "bg-white" : "bg-zinc-50/40"} hover:bg-[#ebf4ff]`}
                  >
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 ${col.align === "right" ? "text-right" : "text-left"} text-[#132960]`}
                      >
                        {renderCell(row, col.key as SortKey)}
                      </td>
                    ))}
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-zinc-500">
                      Nenhum ativo bate os filtros aplicados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-zinc-600">
            “—”: a fonte não informou o múltiplo. <strong>n/s*</strong>: valor atípico na fonte (por
            exemplo, patrimônio negativo), sem leitura útil — passe o mouse para ver o número bruto.
          </p>
        </div>
      )}
    </MarketCard>
  );
}
