"use client";

import { useState } from "react";

export const COR_PRIMARIA = "#132960";
export const COR_ACENTO = "#027DFC";
export const COR_POSITIVO = "#16a34a";
export const COR_NEGATIVO = "#dc2626";
export const COR_NEUTRO = "#71717a";

export const CORES_SERIES = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#1e3a8a",
  "#15803d",
] as const;

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
export function KPI({
  label,
  value,
  unit,
  trend,
  hint,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  hint?: string;
}) {
  const trendColor =
    trend === "up" ? COR_POSITIVO : trend === "down" ? COR_NEGATIVO : COR_NEUTRO;
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
        : value;
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color: trendColor }}>
          {display}
        </span>
        {unit && <span className="text-sm text-zinc-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-zinc-400">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------
export type ToggleOption<T extends string> = { value: T; label: string };

export function Toggle<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: ToggleOption<T>[];
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <div className="inline-flex flex-wrap rounded-full border border-zinc-200 bg-zinc-50 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`${padding} rounded-full font-medium transition ${
              active
                ? "bg-[#027DFC] text-white shadow-sm"
                : "text-zinc-600 hover:text-[#132960]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook de horizonte
// ---------------------------------------------------------------------------
export function useHorizonte(
  options: readonly { value: string; label: string; n: number }[],
  defaultValue: string,
) {
  const [horizonte, setHorizonte] = useState<string>(defaultValue);
  const opt = options.find((o) => o.value === horizonte) ?? options[0];
  return { horizonte, setHorizonte, n: opt.n, options };
}

// ---------------------------------------------------------------------------
// CardHeader
// ---------------------------------------------------------------------------
export function CardHeader({
  titulo,
  subtitulo,
  divulgadoEm,
  periodoReferencia,
  rightSlot,
}: {
  titulo: string;
  subtitulo: string;
  divulgadoEm?: string;
  periodoReferencia?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132960]">{titulo}</h1>
          <p className="mt-1 text-sm text-zinc-600">{subtitulo}</p>
          {(divulgadoEm || periodoReferencia) && (
            <p className="mt-2 text-xs text-zinc-500">
              {divulgadoEm && (
                <>
                  Divulgado em <strong className="text-zinc-700">{divulgadoEm}</strong>
                </>
              )}
              {divulgadoEm && periodoReferencia && " · "}
              {periodoReferencia && (
                <>
                  Referência: <strong className="text-zinc-700">{periodoReferencia}</strong>
                </>
              )}
            </p>
          )}
        </div>
        {rightSlot}
      </div>
    </header>
  );
}

export function formatDivulgadoEm(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// SectionShell
// ---------------------------------------------------------------------------
export function Section({
  titulo,
  rightSlot,
  hint,
  children,
}: {
  titulo: string;
  rightSlot?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#132960]">{titulo}</h2>
        {rightSlot}
      </div>
      {children}
      {hint && <p className="mt-2 text-[11px] text-zinc-500">{hint}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// RankingTable — lista ordenada de categorias por variação
// ---------------------------------------------------------------------------
export function RankingTable({
  items,
  colunaPrincipal = "var_yoy",
  labelPrincipal = "Var. anual",
  maxRows = 99,
}: {
  items: { nome: string; var_yoy?: number | null; var_mom_sa?: number | null; var_acum_12m?: number | null; indice_sa?: number | null }[];
  colunaPrincipal?: "var_yoy" | "var_mom_sa" | "var_acum_12m";
  labelPrincipal?: string;
  maxRows?: number;
}) {
  const sorted = [...items]
    .filter((x) => x[colunaPrincipal] !== null && x[colunaPrincipal] !== undefined)
    .sort((a, b) => (b[colunaPrincipal] as number) - (a[colunaPrincipal] as number))
    .slice(0, maxRows);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Categoria</th>
            <th className="py-2 pr-2 text-right font-medium">{labelPrincipal}</th>
            <th className="py-2 pr-2 text-right font-medium">MoM SA</th>
            <th className="py-2 pr-2 text-right font-medium">Acum 12m</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it, i) => {
            const v = it[colunaPrincipal] as number;
            const cor = v >= 0 ? COR_POSITIVO : COR_NEGATIVO;
            return (
              <tr key={`${it.nome}-${i}`} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-1.5 pr-2 text-zinc-400 tabular-nums">{i + 1}</td>
                <td className="py-1.5 pr-2 text-zinc-700">{it.nome}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums font-semibold" style={{ color: cor }}>
                  {v >= 0 ? "+" : ""}
                  {v.toFixed(2)}%
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-600">
                  {it.var_mom_sa !== null && it.var_mom_sa !== undefined
                    ? `${(it.var_mom_sa as number) >= 0 ? "+" : ""}${(it.var_mom_sa as number).toFixed(2)}%`
                    : "—"}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-600">
                  {it.var_acum_12m !== null && it.var_acum_12m !== undefined
                    ? `${(it.var_acum_12m as number) >= 0 ? "+" : ""}${(it.var_acum_12m as number).toFixed(2)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap — celulas coloridas por variação
// ---------------------------------------------------------------------------
export function Heatmap({
  rows,
  cols,
  values,
  formatValue = (v) => (v === null ? "" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`),
  minVal,
  maxVal,
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  formatValue?: (v: number) => string;
  minVal?: number;
  maxVal?: number;
}) {
  // Calcula range automaticamente se não fornecido
  const flat = values.flat().filter((v): v is number => v !== null && v !== undefined);
  const auto_min = flat.length ? Math.min(...flat) : -10;
  const auto_max = flat.length ? Math.max(...flat) : 10;
  const mn = minVal ?? auto_min;
  const mx = maxVal ?? auto_max;
  const range = Math.max(Math.abs(mn), Math.abs(mx));

  const cellColor = (v: number | null): string => {
    if (v === null || v === undefined) return "#fafafa";
    const norm = Math.max(-1, Math.min(1, v / range));
    if (norm >= 0) {
      // verde
      const alpha = Math.abs(norm);
      return `rgba(22, 163, 74, ${alpha.toFixed(2)})`;
    } else {
      const alpha = Math.abs(norm);
      return `rgba(220, 38, 38, ${alpha.toFixed(2)})`;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-left pr-3" style={{ minWidth: 200 }}></th>
            {cols.map((c) => (
              <th key={c} className="text-[10px] text-zinc-500 px-1" style={{ width: 36 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row}>
              <td className="text-xs text-zinc-700 pr-3 truncate" style={{ maxWidth: 220 }} title={row}>
                {row}
              </td>
              {cols.map((_, j) => {
                const v = values[i]?.[j] ?? null;
                return (
                  <td
                    key={j}
                    title={v !== null ? `${row} · ${cols[j]}: ${v.toFixed(2)}%` : ""}
                    className="text-[9px] text-center tabular-nums"
                    style={{
                      background: cellColor(v),
                      width: 36,
                      height: 24,
                      color: v !== null && Math.abs(v / range) > 0.55 ? "white" : "#3f3f46",
                      borderRadius: 3,
                    }}
                  >
                    {v !== null && v !== undefined ? formatValue(v) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
