"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const FMT_NUM_BR = new Intl.NumberFormat("pt-BR");

export function fmtMes(s: string): string {
  if (!s) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export function fmtMesLongo(s: string): string {
  if (!s) return "";
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const [y, m] = s.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}

export function fmtTrim(s: string): string {
  if (!s) return "";
  const [y, t] = s.split("-T");
  return `${t}T${y.slice(2)}`;
}

export function fmtSaldo(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return sign + FMT_NUM_BR.format(Math.round(v));
}

export function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return v.toFixed(digits) + "%";
}

export function fmtPP(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return sign + v.toFixed(digits) + " p.p.";
}

// ============================================================
// KPICard — card de KPI com valor principal + variação YoY
// ============================================================
export function KPICard({
  label,
  value,
  hint,
  delta,
  deltaUnit,
  invertColor = false,
  size = "md",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaUnit?: "%" | "p.p." | "abs";
  invertColor?: boolean;
  size?: "md" | "lg";
}) {
  const deltaText = (() => {
    if (delta == null) return null;
    const sign = delta >= 0 ? "+" : "";
    if (deltaUnit === "p.p.") return `${sign}${delta.toFixed(1)} p.p.`;
    if (deltaUnit === "abs") return `${sign}${FMT_NUM_BR.format(Math.round(delta))}`;
    return `${sign}${delta.toFixed(1)}%`;
  })();

  const positive = delta != null && delta >= 0;
  // Quando invertColor (ex: desocupação caindo é bom), positive vira "bom" se negativo
  const isGood = invertColor ? !positive : positive;
  const deltaColor =
    delta == null
      ? "text-zinc-400"
      : isGood
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 ${size === "lg" ? "text-2xl" : "text-xl"} font-bold text-zinc-900 tabular-nums`}>
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {deltaText && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${deltaColor}`}>
            {deltaText}
          </span>
        )}
        {hint && <span className="text-[10px] text-zinc-500">{hint}</span>}
      </div>
    </div>
  );
}

// ============================================================
// PieDistribution — pizza com legenda lateral
// ============================================================
export function PieDistribution({
  data,
  colors,
  title,
  totalLabel,
  height = 240,
  valueFmt = (v) => FMT_NUM_BR.format(Math.round(v)),
}: {
  data: { name: string; value: number }[];
  colors: string[] | Record<string, string>;
  title?: string;
  totalLabel?: string;
  height?: number;
  valueFmt?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + Math.abs(d.value), 0);
  const getColor = (name: string, i: number): string => {
    if (Array.isArray(colors)) return colors[i % colors.length];
    return colors[name] ?? "#9ca3af";
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      {title && <div className="mb-2 text-xs font-semibold text-zinc-700">{title}</div>}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div style={{ width: "100%", maxWidth: 200, height }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data.map((d) => ({ ...d, value: Math.abs(d.value) }))}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={1}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={getColor(d.name, i)} />
                ))}
              </Pie>
              <RTooltip
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const pct = total ? ((v / total) * 100).toFixed(1) : "0";
                  return [`${valueFmt(v)} (${pct}%)`, String(name ?? "")];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1">
          {totalLabel && (
            <div className="mb-1 text-[11px] text-zinc-500">
              {totalLabel}: <strong className="text-zinc-900">{valueFmt(total)}</strong>
            </div>
          )}
          <ul className="space-y-0.5 text-[11px]">
            {data.map((d, i) => {
              const pct = total ? (Math.abs(d.value) / total) * 100 : 0;
              return (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: getColor(d.name, i) }} />
                    <span className="truncate text-zinc-700">{d.name}</span>
                  </span>
                  <span className="tabular-nums text-zinc-600">{pct.toFixed(1)}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Heatmap — sazonal (anos × meses ou trim)
// ============================================================
export function Heatmap({
  rows,
  cols,
  data,
  valueFmt = (v) => v.toFixed(1),
  colorScale,
  title,
  caption,
}: {
  rows: string[]; // ex: ["2020","2021",...]
  cols: string[]; // ex: ["jan","fev",...] ou ["1T","2T","3T","4T"]
  data: Record<string, Record<string, number | null>>; // data[row][col] = value
  valueFmt?: (v: number) => string;
  colorScale: (v: number) => string;
  title?: string;
  caption?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      {title && <div className="mb-2 text-xs font-semibold text-zinc-700">{title}</div>}
      <div className="overflow-x-auto">
        <table className="border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="px-1 py-0.5 text-left font-medium text-zinc-500"></th>
              {cols.map((c) => (
                <th key={c} className="px-1 py-0.5 text-center font-medium text-zinc-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <td className="px-1 py-0.5 font-medium text-zinc-600">{r}</td>
                {cols.map((c) => {
                  const v = data[r]?.[c];
                  if (v == null) {
                    return (
                      <td key={c} className="px-1 py-0.5 text-center">
                        <div className="h-7 w-12 rounded-sm bg-zinc-100" />
                      </td>
                    );
                  }
                  const bg = colorScale(v);
                  const isDark = isDarkBg(bg);
                  return (
                    <td key={c} className="px-1 py-0.5 text-center">
                      <div
                        className={`h-7 w-12 rounded-sm flex items-center justify-center font-semibold tabular-nums ${isDark ? "text-white" : "text-zinc-900"}`}
                        style={{ background: bg }}
                        title={`${r} ${c}: ${valueFmt(v)}`}
                      >
                        {valueFmt(v)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <div className="mt-2 text-[10px] italic text-zinc-500">{caption}</div>}
    </div>
  );
}

function isDarkBg(hex: string): boolean {
  // converte hex pra rgb e checa luminosidade
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.55;
}

// Escalas de cor utilitárias
export function divergingScale(min: number, max: number) {
  // verde (-) ... cinza (0) ... vermelho (+) — neutra; para saldo CAGED é o oposto.
  return (v: number) => {
    if (v == null) return "#f3f4f6";
    const range = Math.max(Math.abs(min), Math.abs(max));
    const t = Math.max(-1, Math.min(1, v / (range || 1)));
    if (t > 0) {
      const a = Math.round(255 * (1 - t * 0.8));
      return `#${(255).toString(16)}${a.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
    } else {
      const a = Math.round(255 * (1 - Math.abs(t) * 0.8));
      return `#${a.toString(16).padStart(2, "0")}${(220).toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
    }
  };
}

export function divergingSaldoScale(min: number, max: number) {
  // verde (+ bom) ... cinza (0) ... vermelho (- ruim) — pra saldo de emprego
  return (v: number) => {
    if (v == null) return "#f3f4f6";
    const range = Math.max(Math.abs(min), Math.abs(max));
    const t = Math.max(-1, Math.min(1, v / (range || 1)));
    if (t > 0) {
      // verde
      const a = Math.round(255 - 200 * t);
      return `#${a.toString(16).padStart(2, "0")}${(220).toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
    } else {
      // vermelho
      const a = Math.round(255 - 200 * Math.abs(t));
      return `#${(220).toString(16)}${a.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
    }
  };
}

export function sequentialScale(min: number, max: number, hue: "blue" | "orange" = "blue") {
  return (v: number) => {
    if (v == null) return "#f3f4f6";
    const t = (v - min) / (max - min || 1);
    const clamped = Math.max(0, Math.min(1, t));
    if (hue === "blue") {
      // claro -> azul forte (#cfe8ff -> #1e3a8a)
      const r = Math.round(207 - 177 * clamped);
      const g = Math.round(232 - 174 * clamped);
      const b = Math.round(255 - 117 * clamped);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    // orange
    const r = Math.round(255 - 30 * clamped);
    const g = Math.round(237 - 130 * clamped);
    const b = Math.round(214 - 200 * clamped);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };
}

// ============================================================
// RankingTable — tabela ordenada com até 2 colunas numéricas
// ============================================================
export type RankingRow = {
  label: string;
  value: number;
  delta?: number | null;
  extra?: string;
};

export function RankingTable({
  data,
  title,
  valueLabel,
  valueFmt = (v) => FMT_NUM_BR.format(Math.round(v)),
  deltaLabel = "vs ano",
  deltaUnit = "%",
  topN = 5,
  bottomN = 0,
  colorAccent,
}: {
  data: RankingRow[];
  title: string;
  valueLabel: string;
  valueFmt?: (v: number) => string;
  deltaLabel?: string;
  deltaUnit?: "%" | "p.p." | "abs";
  topN?: number;
  bottomN?: number;
  colorAccent?: (row: RankingRow, kind: "top" | "bottom") => string | undefined;
}) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);
  const top = sorted.slice(0, topN);
  const bottom = bottomN > 0 ? sorted.slice(-bottomN).reverse() : [];

  const renderRows = (rows: RankingRow[], kind: "top" | "bottom") =>
    rows.map((r, i) => {
      const accent = colorAccent?.(r, kind);
      const deltaText = (() => {
        if (r.delta == null) return null;
        const sign = r.delta >= 0 ? "+" : "";
        if (deltaUnit === "p.p.") return `${sign}${r.delta.toFixed(1)} p.p.`;
        if (deltaUnit === "abs") return `${sign}${FMT_NUM_BR.format(Math.round(r.delta))}`;
        return `${sign}${r.delta.toFixed(1)}%`;
      })();
      const deltaColor =
        r.delta == null ? "text-zinc-400" : r.delta >= 0 ? "text-emerald-700" : "text-red-700";
      return (
        <tr key={`${kind}-${i}-${r.label}`} className="border-b border-zinc-100 last:border-0">
          <td className="py-1 pr-2 text-zinc-700">
            {accent && <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: accent }} />}
            {r.label}
            {r.extra && <span className="ml-1 text-[10px] text-zinc-400">{r.extra}</span>}
          </td>
          <td className="py-1 px-2 text-right font-medium tabular-nums text-zinc-900">{valueFmt(r.value)}</td>
          <td className={`py-1 pl-2 text-right tabular-nums ${deltaColor}`}>{deltaText ?? ""}</td>
        </tr>
      );
    });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold text-zinc-700">{title}</div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-1 pr-2 text-left font-medium">{topN > 0 && bottomN === 0 ? "Top" : "Categoria"}</th>
            <th className="py-1 px-2 text-right font-medium">{valueLabel}</th>
            <th className="py-1 pl-2 text-right font-medium">{deltaLabel}</th>
          </tr>
        </thead>
        <tbody>
          {renderRows(top, "top")}
          {bottom.length > 0 && (
            <>
              <tr>
                <td colSpan={3} className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Piores
                </td>
              </tr>
              {renderRows(bottom, "bottom")}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// DataTable — tabela completa com ordenação e export CSV
// ============================================================
export type TableColumn<T> = {
  key: keyof T | string;
  label: string;
  align?: "left" | "right";
  fmt?: (v: any, row: T) => ReactNode;
  sortable?: boolean;
  numericValue?: (row: T) => number | null;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  exportFilename,
  initialSortKey,
  initialSortDir = "desc",
  maxHeight = 360,
}: {
  data: T[];
  columns: TableColumn<T>[];
  title?: string;
  exportFilename?: string;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  maxHeight?: number;
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => String(c.key) === sortKey);
    if (!col) return data;
    const getNum = col.numericValue ?? ((row: T) => {
      const v = row[col.key as keyof T];
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    });
    return [...data].sort((a, b) => {
      const av = getNum(a);
      const bv = getNum(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, columns, sortKey, sortDir]);

  const onSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCSV = () => {
    const header = columns.map((c) => `"${c.label}"`).join(",");
    const lines = sorted.map((row) =>
      columns
        .map((c) => {
          const v = row[c.key as keyof T];
          const s = v == null ? "" : String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename || "tabela.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        {title && <div className="text-xs font-semibold text-zinc-700">{title}</div>}
        {exportFilename && (
          <button
            onClick={exportCSV}
            className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Exportar CSV
          </button>
        )}
      </div>
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-zinc-200 text-zinc-500">
              {columns.map((c) => {
                const isSorted = sortKey === String(c.key);
                const sortable = c.sortable !== false;
                return (
                  <th
                    key={String(c.key)}
                    className={`py-1 px-2 text-${c.align ?? "right"} font-medium ${sortable ? "cursor-pointer hover:text-zinc-900" : ""}`}
                    onClick={sortable ? () => onSort(String(c.key)) : undefined}
                  >
                    {c.label}
                    {isSorted && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                {columns.map((c) => {
                  const v = row[c.key as keyof T];
                  const content = c.fmt ? c.fmt(v, row) : (v as ReactNode);
                  return (
                    <td key={String(c.key)} className={`py-1 px-2 text-${c.align ?? "right"} tabular-nums text-zinc-700`}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Toggle e Chip (extraídos dos dashboards atuais)
// ============================================================
export function Toggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 font-medium transition ${
            value === o.value
              ? "bg-zinc-900 text-white"
              : o.disabled
                ? "bg-zinc-50 text-zinc-300 cursor-not-allowed"
                : "bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  label,
  color,
  ativo,
  onClick,
}: {
  label: string;
  color: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        ativo ? "border-zinc-900 bg-white text-zinc-900" : "border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? color : "#d1d5db" }} />
      {label}
    </button>
  );
}

// ============================================================
// Helper: variação YoY/MoM
// ============================================================
export function deltaPct(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function deltaPP(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null) return null;
  return curr - prev;
}

export function deltaAbs(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null) return null;
  return curr - prev;
}

// pega o trim/mes mesmo período no ano anterior
export function findSameMesAnoAnterior<T extends { mes: string }>(serie: T[], mes: string): T | null {
  const [y, m] = mes.split("-");
  const target = `${parseInt(y, 10) - 1}-${m}`;
  return serie.find((s) => s.mes === target) ?? null;
}

export function findSameTrimAnoAnterior<T extends { trim: string }>(serie: T[], trim: string): T | null {
  const [y, t] = trim.split("-T");
  const target = `${parseInt(y, 10) - 1}-T${t}`;
  return serie.find((s) => s.trim === target) ?? null;
}
