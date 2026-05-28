"use client";

import { useMemo, useState } from "react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CodaceFaixa } from "@/lib/painel-visao-geral";

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
  codace = [],
}: {
  series: SerieExplorador[];
  titulo?: string;
  subtitulo?: string;
  initialId?: string;
  codace?: CodaceFaixa[];
}) {
  const [selecionadaId, setSelecionadaId] = useState<string>(initialId ?? series[0]?.id ?? "");
  const [periodoMeses, setPeriodoMeses] = useState<number | "max">(60); // 5 anos default
  const [clipOutliers, setClipOutliers] = useState<boolean>(false);
  const selecionada = series.find((s) => s.id === selecionadaId) ?? series[0];
  const dadosFiltrados = useMemo(() => {
    if (!selecionada) return [];
    let dados = selecionada.data;
    if (periodoMeses !== "max" && typeof periodoMeses === "number") {
      dados = dados.slice(-periodoMeses);
    }
    if (clipOutliers && dados.length > 24) {
      const vals = dados.map((d) => d.v).filter((v): v is number => v !== null && v !== undefined);
      if (vals.length > 0) {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
        const lo = m - 3 * sd;
        const hi = m + 3 * sd;
        dados = dados.map((d) => ({
          mes: d.mes,
          v: d.v !== null && d.v !== undefined ? Math.max(lo, Math.min(hi, d.v)) : d.v,
        }));
      }
    }
    return dados;
  }, [selecionada, periodoMeses, clipOutliers]);

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
        <div className="mb-2 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-1 text-[10px] flex-wrap">
            <span className="text-zinc-500 mr-1">Período:</span>
            {([
              { v: 12, l: "1a" },
              { v: 36, l: "3a" },
              { v: 60, l: "5a" },
              { v: 120, l: "10a" },
              { v: "max" as const, l: "max" },
            ] as const).map((b) => (
              <button
                key={b.l}
                type="button"
                onClick={() => setPeriodoMeses(b.v)}
                className={`rounded px-2 py-0.5 ${periodoMeses === b.v ? "bg-[#132960] text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"}`}
              >
                {b.l}
              </button>
            ))}
            <label className="ml-2 inline-flex items-center gap-1 text-zinc-600">
              <input type="checkbox" checked={clipOutliers} onChange={(e) => setClipOutliers(e.target.checked)} className="h-3 w-3" />
              Clip ±3σ
            </label>
          </div>
        </div>
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
            <LineChart data={dadosFiltrados} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 9 }}
                interval={Math.max(1, Math.floor(dadosFiltrados.length / 10))}
              />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v.toFixed(unid === "%" ? 0 : 1)}${unid}`} />
              <Tooltip
                formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}${unid}` : "—")}
                labelFormatter={(l: unknown) => formatMes(String(l ?? ""))}
              />
              {selecionada.refLine !== undefined && (
                <ReferenceLine y={selecionada.refLine} stroke="#000" strokeDasharray="2 4" />
              )}
              {codace.map((f, i) => (
                <ReferenceArea key={`cod-${f.pico}-${i}`} x1={f.pico} x2={f.vale} fill="#9CA3AF" fillOpacity={0.12} ifOverflow="visible" />
              ))}
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
