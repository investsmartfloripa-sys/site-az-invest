"use client";

import { useState } from "react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMes } from "@/lib/painel-visao-geral";

export type SeriePonto = { mes: string; v: number | null | undefined };

export type SerieExplorador = {
  id: string;
  titulo: string;
  subtitulo?: string;
  cor: string;
  unidade?: string; // ex: "%" ou "" (indice)
  valorAtual: number | null | undefined;
  mesAtual?: string | null;
  data: SeriePonto[];
  // refLine (opcional): linha de referencia horizontal (ex: 0 para YoY, 100 para indice base)
  refLine?: number;
};

export function ExploradorSeries({
  series,
  titulo = "Series",
  subtitulo,
  initialId,
}: {
  series: SerieExplorador[];
  titulo?: string;
  subtitulo?: string;
  initialId?: string;
}) {
  const [selecionadaId, setSelecionadaId] = useState<string>(initialId ?? series[0]?.id ?? "");
  const selecionada = series.find((s) => s.id === selecionadaId) ?? series[0];

  if (!series.length || !selecionada) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-xs text-zinc-400">
        Nenhuma série disponível ainda.
      </div>
    );
  }

  const unid = selecionada.unidade ?? "%";

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{titulo}</h3>
          {subtitulo && <p className="text-xs text-zinc-500">{subtitulo}</p>}
        </div>
        <span className="text-[10px] text-zinc-500">{series.length} séries · clique no card para trocar</span>
      </div>

      {/* Area do grafico unica */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: selecionada.cor }} />
              <h4 className="text-sm font-bold text-zinc-900">{selecionada.titulo}</h4>
            </div>
            {selecionada.subtitulo && <p className="mt-0.5 text-[11px] text-zinc-500">{selecionada.subtitulo}</p>}
          </div>
          <div className="text-right">
            <div
              className={`text-2xl font-bold ${
                selecionada.valorAtual === null || selecionada.valorAtual === undefined
                  ? "text-zinc-300"
                  : selecionada.valorAtual >= 0
                    ? "text-emerald-700"
                    : "text-rose-700"
              }`}
            >
              {selecionada.valorAtual === null || selecionada.valorAtual === undefined
                ? "—"
                : `${selecionada.valorAtual >= 0 && unid === "%" ? "+" : ""}${selecionada.valorAtual.toFixed(1)}${unid}`}
            </div>
            <div className="text-[10px] text-zinc-500">{selecionada.mesAtual ? formatMes(selecionada.mesAtual) : ""}</div>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selecionada.data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 9 }}
                interval={Math.max(1, Math.floor(selecionada.data.length / 10))}
              />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v.toFixed(unid === "%" ? 0 : 1)}${unid}`} />
              <Tooltip
                formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}${unid}` : "—")}
                labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
              />
              {selecionada.refLine !== undefined && (
                <ReferenceLine y={selecionada.refLine} stroke="#000" strokeDasharray="2 4" />
              )}
              <Line type="monotone" dataKey="v" stroke={selecionada.cor} strokeWidth={1.8} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid de cards-thumbnail (seletores) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {series.map((s) => {
          const ativa = s.id === selecionadaId;
          const u = s.unidade ?? "%";
          const valorTxt =
            s.valorAtual === null || s.valorAtual === undefined
              ? "—"
              : `${s.valorAtual >= 0 && u === "%" ? "+" : ""}${s.valorAtual.toFixed(1)}${u}`;
          const valorCor =
            s.valorAtual === null || s.valorAtual === undefined
              ? "text-zinc-300"
              : s.valorAtual >= 0
                ? "text-emerald-700"
                : "text-rose-700";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelecionadaId(s.id)}
              className={`text-left rounded-lg border p-2 transition-all ${
                ativa
                  ? "border-[#132960] bg-[#132960]/5 shadow-sm ring-1 ring-[#132960]/30"
                  : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
              }`}
              aria-pressed={ativa}
              title={s.subtitulo ?? s.titulo}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.cor }} />
                <span className={`text-[10px] font-semibold truncate ${ativa ? "text-[#132960]" : "text-zinc-800"}`}>
                  {s.titulo}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-1">
                <span className={`text-sm font-bold ${valorCor}`}>{valorTxt}</span>
                {s.mesAtual && <span className="text-[9px] text-zinc-400">{formatMes(s.mesAtual)}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
