"use client";

/**
 * Peças "do livro" reaproveitadas do Termômetro Fiscal original (movidas para
 * cá na reforma Indicadores de Risco Fiscal): as matrizes Debt-to-Income de
 * 10 anos com a célula Brasil destacada e os cards dos 4 Levers com
 * viabilidade derivada por regra.
 */

import type { Matriz } from "@/lib/painel-fiscal";

function fmt(v: number | null | undefined, casas = 1, suf = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(casas)}${suf}`;
}
function fmtPP(v: number | null | undefined, casas = 2): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(casas)} pp`;
}

// ─── Matriz Dalio (heatmap-tabela) ───────────────────────────────────────────
function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.5) {
    const k = c / 0.5;
    const r = Math.round(220 + (252 - 220) * k);
    const g = Math.round(252 - (252 - 230) * k);
    const b = Math.round(220 - (220 - 170) * k);
    return `rgb(${r},${g},${b})`;
  }
  const k = (c - 0.5) / 0.5;
  const r = Math.round(252 - (252 - 220) * k);
  const g = Math.round(230 - 230 * k * 0.6);
  const b = Math.round(170 - 170 * k);
  return `rgb(${r},${g},${b})`;
}

export function MatrizDalio({
  matriz,
  eixoX,
  labelY,
  labelX,
  sufY = "%",
  sufX = "%",
  destacaBR = true,
  premissaTexto,
}: {
  matriz: Matriz;
  eixoX: number[];
  labelY: string;
  labelX: string;
  sufY?: string;
  sufX?: string;
  destacaBR?: boolean;
  premissaTexto?: string;
}) {
  const flat = matriz.valores.flat();
  const vmin = Math.min(...flat);
  const vmax = Math.max(...flat);
  const range = vmax - vmin || 1;
  const brStart = matriz.brasil?.starting ?? null;
  const brX = matriz.brasil?.deficit ?? matriz.brasil?.gap_pp ?? null;
  const idxY =
    brStart == null
      ? -1
      : matriz.eixo_y_starting.reduce(
          (bi, v, i) => (Math.abs(v - brStart) < Math.abs(matriz.eixo_y_starting[bi] - brStart) ? i : bi),
          0,
        );
  const idxX =
    brX == null ? -1 : eixoX.reduce((bi, v, i) => (Math.abs(v - brX) < Math.abs(eixoX[bi] - brX) ? i : bi), 0);

  return (
    <div className="space-y-2">
      {premissaTexto && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
          <strong className="uppercase tracking-wide">Premissa: </strong>
          {premissaTexto}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <span className="font-semibold text-[#132960]">{labelX} →</span>
        </div>
        <table className="mt-1 w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-zinc-200 bg-[#132960] p-2 text-left text-[10px] uppercase tracking-wider text-white">
                <span className="block text-[9px] opacity-80">↓</span>
                {labelY}
              </th>
              {eixoX.map((v, i) => {
                const isBR = destacaBR && i === idxX;
                return (
                  <th
                    key={i}
                    className={`border border-zinc-200 p-2 font-semibold ${isBR ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
                  >
                    {v}
                    {sufX}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matriz.valores.map((row, i) => {
              const isBRRow = destacaBR && i === idxY;
              return (
                <tr key={i}>
                  <th
                    className={`border border-zinc-200 p-2 text-right font-semibold ${isBRRow ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
                  >
                    {matriz.eixo_y_starting[i]}
                    {sufY}
                  </th>
                  {row.map((cell, j) => {
                    const isBR = destacaBR && i === idxY && j === idxX;
                    const t = (cell - vmin) / range;
                    return (
                      <td
                        key={j}
                        className={`border p-2 text-center tabular-nums ${
                          isBR
                            ? "border-rose-600 border-[3px] font-bold text-rose-950 ring-2 ring-rose-600 ring-offset-1"
                            : "border-zinc-200 text-zinc-800"
                        }`}
                        style={{ background: isBR ? "#fecaca" : heatColor(t) }}
                      >
                        {cell}%
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {destacaBR && matriz.brasil?.starting != null && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-[3px] border-rose-600 bg-rose-100"></span>
            <strong>Brasil hoje:</strong> linha {matriz.brasil.starting}
            {sufY} × coluna {matriz.brasil.deficit ?? matriz.brasil.gap_pp}
            {sufX}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Lever card ──────────────────────────────────────────────────────────────
// Viabilidade derivada por regra simples (heurística AZ — nunca literal fixo):
// ajuste ≤ 2 pp (juros/inflação) ou ≤ 5% (despesa/receita) → "media" (Possível);
// acima → "baixa" (Difícil). Avalia a magnitude do ajuste, não o mérito político.
export function viabilidadeLever(ajuste: number | null | undefined, limite: number): "media" | "baixa" {
  if (ajuste == null) return "baixa";
  return Math.abs(ajuste) <= limite ? "media" : "baixa";
}

export function LeverCard({
  numero,
  titulo,
  descricao,
  atual,
  alvo,
  delta,
  deltaTexto,
  sufix,
  baseLabel,
  viavel,
}: {
  numero: number;
  titulo: string;
  descricao: string;
  atual: number | undefined;
  alvo: number | undefined;
  delta?: number;
  deltaTexto?: string;
  sufix: string;
  baseLabel: string;
  viavel?: "alta" | "media" | "baixa";
}) {
  const viabilidadeBg =
    viavel === "baixa"
      ? "bg-rose-100 border-rose-300"
      : viavel === "media"
        ? "bg-amber-100 border-amber-300"
        : "bg-emerald-100 border-emerald-300";
  const viabilidadeTxt = viavel === "baixa" ? "Difícil" : viavel === "media" ? "Possível" : "Plausível";
  return (
    <div className="rounded-2xl border border-[#132960]/15 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#132960]">
            <span className="mr-1 text-zinc-400">{numero}.</span>
            {titulo}
          </h3>
          <p className="mt-1 text-xs text-zinc-600">{descricao}</p>
        </div>
        {viavel && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${viabilidadeBg}`}>
            {viabilidadeTxt}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Atual</div>
          <div className="text-lg font-bold text-zinc-700">{fmt(atual, 2, sufix)}</div>
        </div>
        <div className="rounded-lg bg-rose-50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-rose-700">Necessário</div>
          <div className="text-lg font-bold text-rose-800">{fmt(alvo, 2, sufix)}</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-zinc-500">Base: {baseLabel}</div>
      {delta != null && (
        <div className="mt-1 text-xs text-zinc-700">
          Ajuste: <strong className="text-[#132960]">{deltaTexto ?? fmtPP(delta)}</strong>
        </div>
      )}
    </div>
  );
}
