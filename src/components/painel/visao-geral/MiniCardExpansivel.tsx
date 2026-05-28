"use client";

import { useState, type ReactNode } from "react";

import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";

import { formatMes } from "@/lib/painel-visao-geral";

type SparkPoint = { mes: string; v: number | null | undefined };

export function MiniCardExpansivel({
  titulo,
  subtitulo,
  valorAtual,
  unidade = "%",
  cor,
  mesAtual,
  spark,
  expanded: graficoCompleto,
}: {
  titulo: string;
  subtitulo?: string;
  valorAtual: number | null | undefined;
  unidade?: string;
  cor: string;
  mesAtual?: string | null;
  spark: SparkPoint[];
  expanded?: ReactNode; // gráfico completo (component) renderizado quando aberto
}) {
  const [open, setOpen] = useState(false);
  const valorTxt =
    valorAtual === null || valorAtual === undefined
      ? "—"
      : `${valorAtual >= 0 && unidade === "%" ? "+" : ""}${valorAtual.toFixed(1)}${unidade}`;
  const corValor =
    valorAtual === null || valorAtual === undefined
      ? "text-zinc-300"
      : valorAtual >= 0
        ? "text-emerald-700"
        : "text-rose-700";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full text-left p-3 hover:bg-zinc-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-800 truncate">{titulo}</div>
            {subtitulo && <div className="mt-0.5 text-[10px] text-zinc-500 leading-tight">{subtitulo}</div>}
          </div>
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-xl font-bold ${corValor}`}>{valorTxt}</span>
          {mesAtual && <span className="text-[10px] text-zinc-500">{formatMes(mesAtual)}</span>}
        </div>
        <div className="mt-1 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
              <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="2 2" />
              <Tooltip
                cursor={{ stroke: "#888", strokeWidth: 1 }}
                contentStyle={{ fontSize: 10, padding: "2px 6px" }}
                formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(1) + unidade : "—")}
                labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
              />
              <Line type="monotone" dataKey="v" stroke={cor} strokeWidth={1.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-[10px] text-[#027DFC]">{open ? "Recolher" : "Clique para abrir gráfico completo"}</div>
      </button>
      {open && graficoCompleto && (
        <div className="border-t border-zinc-200 p-3 bg-zinc-50">{graficoCompleto}</div>
      )}
    </div>
  );
}
