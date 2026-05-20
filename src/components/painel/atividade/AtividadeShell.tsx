"use client";

import { useState } from "react";

// Paleta consistente com os outros painéis
export const COR_PRIMARIA = "#132960";
export const COR_ACENTO = "#027DFC";
export const COR_POSITIVO = "#16a34a";
export const COR_NEGATIVO = "#dc2626";

export const CORES_SERIES = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
] as const;

// KPI Card
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
    trend === "up" ? COR_POSITIVO : trend === "down" ? COR_NEGATIVO : "#71717a";
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

// Toggle
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

// Hook de horizonte temporal
export function useHorizonte(
  options: readonly { value: string; label: string; n: number }[],
  defaultValue: string,
) {
  const [horizonte, setHorizonte] = useState<string>(defaultValue);
  const opt = options.find((o) => o.value === horizonte) ?? options[0];
  return { horizonte, setHorizonte, n: opt.n, options };
}

// Header
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
