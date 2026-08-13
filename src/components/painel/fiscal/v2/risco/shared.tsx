"use client";

/**
 * Helpers do painel Indicadores de Risco Fiscal: bandas de risco (faixas AZ
 * calibradas do livro) como ReferenceAreas clipadas à janela visível, cores de
 * nível padronizadas (status ≠ paleta categórica) e o sparkline compacto dos
 * small multiples da camada de esmiuçamento.
 *
 * Convenção de cor de status (PADRAO-VISUAL §3 + skill dataviz): verde-mar
 * #1E8A5C, âmbar #D97706, tijolo #BE3B33, ruptura #7F1D1D — opacidade crescente
 * dá a leitura de gradiente sem virar papel de parede. Nunca cor sozinha: cada
 * banda leva rótulo com o limiar.
 */

import type { AzRefArea } from "@/components/painel/charts/AzTimeSeriesChart";
import type { FaixasRisco, Nivel, PontoMensal } from "@/lib/painel-fiscal";

export { dataIso, toPoints, ultimoPonto, deltaDozeMeses, codaceAreas } from "../divida/shared";

// ─── Cores de nível (status) ─────────────────────────────────────────────────
export const NIVEL_RISCO: Record<
  Nivel,
  { hex: string; chip: string; label: string }
> = {
  verde: { hex: "#1E8A5C", chip: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Seguro" },
  amarelo: { hex: "#D97706", chip: "bg-amber-50 text-amber-800 border-amber-200", label: "Atenção" },
  vermelho: { hex: "#BE3B33", chip: "bg-rose-50 text-rose-800 border-rose-200", label: "Crítico" },
  break: { hex: "#7F1D1D", chip: "bg-red-100 text-red-900 border-red-300", label: "Ruptura" },
  sem_dado: { hex: "#A1A1AA", chip: "bg-zinc-50 text-zinc-500 border-zinc-200", label: "Sem dado" },
};

const BANDA_OPACIDADE: Record<"verde" | "amarelo" | "vermelho" | "break", number> = {
  verde: 0.05,
  amarelo: 0.065,
  vermelho: 0.08,
  break: 0.12,
};

function fmtLimiar(v: number, unidade: string): string {
  const u = unidade.trim();
  const n = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(v % 1 === 0 ? 0 : 1);
  return `${n}${u === "pp" ? " pp" : u}`;
}

/**
 * Converte as faixas do indicador em bandas horizontais CLIPADAS ao range dos
 * valores visíveis (+ a mesma folga de 8% do AzTimeSeriesChart — banda fora do
 * domain é descartada pelo Recharts). Cada banda visível leva rótulo com o
 * limiar; a zona segura é rotulada "seguro".
 */
/** Subconjunto estrutural das faixas — IndicadorSemaforo também satisfaz. */
export type FaixasBase = Pick<FaixasRisco, "direcao" | "verde" | "amarelo" | "vermelho" | "break">;

export function faixasParaBandas(
  faixas: FaixasBase,
  valoresVisiveis: ReadonlyArray<number>,
  unidade = "%",
): AzRefArea[] {
  if (valoresVisiveis.length === 0) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of valoresVisiveis) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const span = hi - lo;
  const pad = (span > 0 ? span * 0.08 : Math.max(Math.abs(hi) * 0.08, 1)) * 0.96;
  const viewLo = lo - pad;
  const viewHi = hi + pad;

  const maiorPior = faixas.direcao === "maior_pior";
  // Zonas em [y1, y2] absolutos (antes do clip).
  const zonas: Array<{ nivel: "verde" | "amarelo" | "vermelho" | "break"; y1: number; y2: number; label: string }> =
    maiorPior
      ? [
          { nivel: "verde", y1: -Infinity, y2: faixas.verde, label: "seguro" },
          { nivel: "amarelo", y1: faixas.verde, y2: faixas.amarelo, label: `atenção ≥ ${fmtLimiar(faixas.verde, unidade)}` },
          { nivel: "vermelho", y1: faixas.amarelo, y2: faixas.break, label: `crítico ≥ ${fmtLimiar(faixas.amarelo, unidade)}` },
          { nivel: "break", y1: faixas.break, y2: Infinity, label: `ruptura ≥ ${fmtLimiar(faixas.break, unidade)}` },
        ]
      : [
          { nivel: "verde", y1: faixas.verde, y2: Infinity, label: "seguro" },
          { nivel: "amarelo", y1: faixas.amarelo, y2: faixas.verde, label: `atenção ≤ ${fmtLimiar(faixas.verde, unidade)}` },
          { nivel: "vermelho", y1: faixas.break, y2: faixas.amarelo, label: `crítico ≤ ${fmtLimiar(faixas.amarelo, unidade)}` },
          { nivel: "break", y1: -Infinity, y2: faixas.break, label: `ruptura ≤ ${fmtLimiar(faixas.break, unidade)}` },
        ];

  const out: AzRefArea[] = [];
  for (const z of zonas) {
    const y1 = Math.max(z.y1, viewLo);
    const y2 = Math.min(z.y2, viewHi);
    if (y2 - y1 <= 0) continue;
    // Banda muito rasa (< 6% do span visível) não comporta rótulo legível.
    const rotulavel = y2 - y1 >= (viewHi - viewLo) * 0.06;
    out.push({
      y1,
      y2,
      color: NIVEL_RISCO[z.nivel].hex,
      opacity: BANDA_OPACIDADE[z.nivel],
      label: rotulavel ? z.label : undefined,
    });
  }
  return out;
}

/** Valores de uma janela [from, to] de uma série de pontos [iso, valor]. */
export function valoresNaJanela(
  data: ReadonlyArray<readonly [string, number]>,
  from: string,
  to: string,
): number[] {
  const out: number[] = [];
  for (const [d, v] of data) {
    if (d >= from && d <= to && Number.isFinite(v)) out.push(v);
  }
  return out;
}

// ─── Sparkline dos small multiples ───────────────────────────────────────────

/**
 * Sparkline SVG puro (sem Recharts — 16 instâncias na grade) com as bandas de
 * risco ao fundo e o último ponto destacado na cor do nível. `preserveAspectRatio
 * "none"` deixa o SVG esticar no card.
 */
export function MiniRiskSpark({
  serie,
  faixas,
  nivel,
  height = 48,
}: {
  serie: ReadonlyArray<PontoMensal>;
  faixas: FaixasBase;
  nivel: Nivel;
  height?: number;
}) {
  const pts = serie.filter((p): p is { data: string; valor: number } => p.valor != null && Number.isFinite(p.valor));
  if (pts.length < 2) return <div style={{ height }} />;

  const W = 160;
  const H = 48;
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    if (p.valor < lo) lo = p.valor;
    if (p.valor > hi) hi = p.valor;
  }
  const span = hi - lo || Math.abs(hi) || 1;
  const pad = span * 0.12;
  const vLo = lo - pad;
  const vHi = hi + pad;
  const y = (v: number) => H - ((v - vLo) / (vHi - vLo)) * H;
  const x = (i: number) => (i / (pts.length - 1)) * W;

  const maiorPior = faixas.direcao === "maior_pior";
  const zonas: Array<{ nivel: "verde" | "amarelo" | "vermelho" | "break"; a: number; b: number }> = maiorPior
    ? [
        { nivel: "verde", a: vLo, b: faixas.verde },
        { nivel: "amarelo", a: faixas.verde, b: faixas.amarelo },
        { nivel: "vermelho", a: faixas.amarelo, b: faixas.break },
        { nivel: "break", a: faixas.break, b: vHi },
      ]
    : [
        { nivel: "verde", a: faixas.verde, b: vHi },
        { nivel: "amarelo", a: faixas.amarelo, b: faixas.verde },
        { nivel: "vermelho", a: faixas.break, b: faixas.amarelo },
        { nivel: "break", a: vLo, b: faixas.break },
      ];

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join("");
  const ult = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
      role="img"
      aria-label="evolução histórica do indicador"
    >
      {zonas.map((z, i) => {
        const a = Math.max(Math.min(z.a, z.b), vLo);
        const b = Math.min(Math.max(z.a, z.b), vHi);
        if (b - a <= 0) return null;
        return (
          <rect
            key={i}
            x={0}
            width={W}
            y={y(b)}
            height={Math.max(0, y(a) - y(b))}
            fill={NIVEL_RISCO[z.nivel].hex}
            opacity={BANDA_OPACIDADE[z.nivel] * 1.6}
          />
        );
      })}
      <path d={path} fill="none" stroke="#132960" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      <circle
        cx={x(pts.length - 1)}
        cy={y(ult.valor)}
        r={3}
        fill={NIVEL_RISCO[nivel].hex}
        stroke="#fff"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
