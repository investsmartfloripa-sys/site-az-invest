import type { AzSeriesPoint } from "@/components/painel/charts/AzTimeSeriesChart";
import { AZ_BRAND, AZ_CHART } from "@/lib/az-chart-theme";

/**
 * Sparkline SVG puro (sem Recharts — leve para dezenas de instâncias numa grade
 * de small multiples). Generalização neutra do MiniRiskSpark do cockpit fiscal:
 * sem zonas de risco; opcionalmente desenha a linha do zero (para séries de
 * variação) e pinta o último ponto pela cor recebida.
 *
 * viewBox 160×48 com preserveAspectRatio="none" — estica à largura do tile.
 * Server-safe.
 */
export function MiniSpark({
  data,
  height = 44,
  color = AZ_BRAND.navy,
  zeroLine = false,
  lastDotColor,
}: {
  data: ReadonlyArray<AzSeriesPoint>;
  height?: number;
  color?: string;
  /** Desenha y = 0 como régua fina (séries de variação). */
  zeroLine?: boolean;
  /** Cor do círculo no último ponto (default: `color`). */
  lastDotColor?: string;
}) {
  const pts = data.filter(([, v]) => Number.isFinite(v));
  if (pts.length < 2) return <div style={{ height }} />;

  const W = 160;
  const H = 48;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [, v] of pts) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (zeroLine) {
    if (lo > 0) lo = 0;
    if (hi < 0) hi = 0;
  }
  const span = hi - lo || Math.abs(hi) || 1;
  const pad = span * 0.12;
  const vLo = lo - pad;
  const vHi = hi + pad;
  const y = (v: number) => H - ((v - vLo) / (vHi - vLo)) * H;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const path = pts.map(([, v], i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ult = pts[pts.length - 1][1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
      role="img"
      aria-label="evolução recente da série"
    >
      {zeroLine ? (
        <line
          x1={0}
          x2={W}
          y1={y(0)}
          y2={y(0)}
          stroke={AZ_CHART.zero}
          strokeOpacity={0.35}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={y(ult)} r={2.6} fill={lastDotColor ?? color} />
    </svg>
  );
}
