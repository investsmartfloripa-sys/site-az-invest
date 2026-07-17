import { AZ_CHART } from "@/lib/az-chart-theme";
import { fmtSignedNum } from "@/lib/format-br";

/**
 * Heatmap padrão AZ (anos × meses/trimestres) — modelo emprego/shared.tsx,
 * mas com escala DISCRETA por degraus (leitura categórica imediata, sem
 * gradiente contínuo ambíguo) + teste de luminância p/ cor do texto.
 * Células com sinal explícito; fonte 10px tabular.
 *
 * Server-safe: sem hooks.
 */

// ---------------------------------------------------------------------------
// Escalas discretas
// ---------------------------------------------------------------------------

/** Degrau de cor: aplica `color` quando `v <= upTo`. */
export type HeatmapStep = { upTo: number; color: string };

/**
 * Escala discreta genérica: percorre os degraus em ordem crescente de
 * `upTo` e devolve a cor do primeiro que contém o valor; acima de todos,
 * `aboveColor`.
 */
export function steppedScale(steps: HeatmapStep[], aboveColor: string): (v: number) => string {
  const sorted = [...steps].sort((a, b) => a.upTo - b.upTo);
  return (v: number) => {
    for (const s of sorted) {
      if (v <= s.upTo) return s.color;
    }
    return aboveColor;
  };
}

/** Mistura linear entre duas cores hex (t=0 → a, t=1 → b). Interno, p/ gerar rampas discretas. */
function mixHex(a: string, b: string, t: number): string {
  const pa = hexRgb(a);
  const pb = hexRgb(b);
  if (!pa || !pb) return a;
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(pa[0], pb[0])}${ch(pa[1], pb[1])}${ch(pa[2], pb[2])}`;
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/**
 * Escala discreta DIVERGENTE na família AZ (verde #1E8A5C / vermelho #BE3B33).
 * `thresholds` são os limites POSITIVOS dos degraus, espelhados p/ o lado
 * negativo. Ex.: `[0.3, 1, 3]` ⇒ 7 faixas:
 * ≤−3 · (−3,−1] · (−1,−0.3] · (−0.3,0.3) · [0.3,1) · [1,3) · ≥3.
 * Quanto mais extremo o valor, mais escura (e mais "texto branco") a célula.
 */
export function steppedDivergingScale(
  thresholds: number[] = [0.3, 1, 3],
  opts?: { posColor?: string; negColor?: string; zeroColor?: string },
): (v: number) => string {
  const pos = opts?.posColor ?? AZ_CHART.pos;
  const neg = opts?.negColor ?? AZ_CHART.neg;
  const zero = opts?.zeroColor ?? "#F1F5F9";
  const filtered = [...thresholds].filter((t) => t > 0).sort((a, b) => a - b);
  const asc = filtered.length > 0 ? filtered : [0.3, 1, 3];
  const n = asc.length;
  // Degrau i (0 = mais suave) → mistura branco→cor cheia.
  const shade = (base: string, i: number) => mixHex("#FFFFFF", base, 0.25 + (0.75 * (i + 1)) / n);
  return (v: number) => {
    if (!Number.isFinite(v)) return "#f4f4f5";
    const abs = Math.abs(v);
    if (abs < asc[0]) return zero;
    let idx = asc.length - 1;
    for (let i = 0; i < asc.length; i++) {
      if (abs < asc[i]) {
        idx = i - 1;
        break;
      }
    }
    return shade(v > 0 ? pos : neg, idx);
  };
}

/**
 * Escala discreta SEQUENCIAL (claro → cheio) na cor base — p/ níveis sem
 * sinal (ex.: estoque, índice). `thresholds` em ordem crescente.
 */
export function steppedSequentialScale(
  thresholds: number[],
  baseColor: string = AZ_CHART.neutral,
): (v: number) => string {
  const asc = [...thresholds].sort((a, b) => a - b);
  const n = Math.max(1, asc.length);
  return (v: number) => {
    if (!Number.isFinite(v)) return "#f4f4f5";
    let idx = 0;
    while (idx < asc.length && v >= asc[idx]) idx++;
    return mixHex("#FFFFFF", baseColor, 0.12 + (0.88 * idx) / n);
  };
}

/** Luminância perceptual < 0.55 ⇒ fundo escuro ⇒ texto branco (modelo emprego/shared). */
export function isDarkBg(hex: string): boolean {
  const rgb = hexRgb(hex);
  if (!rgb) return false;
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum < 0.55;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export type HeatmapProps = {
  /** Rótulos das linhas (ex.: ["2022","2023","2024"]). */
  rows: string[];
  /** Rótulos das colunas (ex.: ["jan",...,"dez"] ou ["1T","2T","3T","4T"]). */
  cols: string[];
  /** data[linha][coluna] = valor (null/undefined = célula vazia cinza). */
  data: Record<string, Record<string, number | null | undefined>>;
  /** Escala de cor — use steppedDivergingScale/steppedSequentialScale. */
  colorScale: (v: number) => string;
  /** Formata o valor da célula — default sinal explícito, 1 casa ("+1,2"/"−0,4"). */
  valueFmt?: (v: number) => string;
  title?: string;
  /** Legenda curta sob a tabela (metodologia, unidade). */
  caption?: string;
  /** Largura da célula em px (default 48). Ignorada quando `stretch`. */
  cellWidth?: number;
  /**
   * ADITIVO (default false = comportamento atual). Quando true, a tabela ocupa
   * 100% da largura do container (table-fixed) e as células dividem o espaço
   * igualmente — p/ heatmaps largos que sobravam vazio no card.
   */
  stretch?: boolean;
  /** Largura da coluna de rótulos em px quando `stretch` (default 150). */
  labelWidth?: number;
};

/**
 * Heatmap discreto com sinal explícito por célula e contraste automático do
 * texto. Ideal p/ sazonalidade (anos × meses) e variações por categoria.
 */
export function Heatmap({
  rows,
  cols,
  data,
  colorScale,
  valueFmt = (v) => fmtSignedNum(v, 1),
  title,
  caption,
  cellWidth = 48,
  stretch = false,
  labelWidth = 150,
}: HeatmapProps) {
  const cellStyle = stretch ? undefined : { width: cellWidth };
  return (
    <div className="rounded-xl border border-[#132960]/10 bg-white p-3">
      {title ? <div className="mb-2 text-xs font-semibold text-[#132960]">{title}</div> : null}
      <div className="overflow-x-auto">
        <table className={`border-collapse text-[10px] ${stretch ? "w-full table-fixed" : ""}`}>
          <thead>
            <tr>
              <th
                className="px-1 py-0.5 text-left font-medium text-zinc-500"
                style={stretch ? { width: labelWidth } : undefined}
              />
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
                <td className="truncate px-1 py-0.5 font-medium text-zinc-600">{r}</td>
                {cols.map((c) => {
                  const v = data[r]?.[c];
                  if (v == null || !Number.isFinite(v)) {
                    return (
                      <td key={c} className="px-0.5 py-0.5 text-center">
                        <div className="h-7 rounded-sm bg-zinc-100" style={cellStyle} />
                      </td>
                    );
                  }
                  const bg = colorScale(v);
                  const dark = isDarkBg(bg);
                  return (
                    <td key={c} className="px-0.5 py-0.5 text-center">
                      <div
                        className={`flex h-7 items-center justify-center rounded-sm font-semibold tabular-nums ${
                          dark ? "text-white" : "text-zinc-900"
                        }`}
                        style={{ background: bg, ...cellStyle }}
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
      {caption ? <div className="mt-2 text-[10px] italic text-zinc-500">{caption}</div> : null}
    </div>
  );
}
