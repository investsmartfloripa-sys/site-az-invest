import { AZ_CHART, AZ_NEUTRAL_BAND } from "@/lib/az-chart-theme";
import { fmtSignedNum, fmtSignedPct } from "@/lib/format-br";

/**
 * Card de KPI padrão AZ — evolução do KPICard de emprego/shared.tsx.
 *
 * Valor grande + badge de delta com SINAL explícito e cor semântica
 * (verde subiu · azul na banda ±0,03 · vermelho caiu). `invertColor` troca a
 * leitura de bom/ruim quando queda é boa (ex.: desocupação, inflação).
 *
 * Server-safe: sem hooks — pode ser renderizado em Server Component.
 */
export type KpiCardProps = {
  /** Rótulo curto em caixa alta (ex.: "Taxa de desocupação"). */
  label: string;
  /** Valor principal JÁ formatado (use fmtNum/fmtPct/fmtBRL de format-br). */
  value: string;
  /** Unidade exibida ao lado do valor (ex.: "% a.a.", "mil vagas"). */
  unit?: string;
  /** Variação numérica do período — vira badge com sinal. */
  delta?: number | null;
  /** Unidade do delta: "%" (default), "p.p." ou "abs". */
  deltaUnit?: "%" | "p.p." | "abs";
  /** Sufixo de contexto do delta dentro do badge (ex.: "vs mês ant."). */
  deltaHint?: string;
  /** true quando QUEDA é boa (desocupação, inflação): inverte verde/vermelho. */
  invertColor?: boolean;
  /** Nota auxiliar pequena abaixo do valor. */
  hint?: string;
  /** md (default) ou lg (KPI de destaque). */
  size?: "md" | "lg";
};

const POS_BG = "rgba(30,138,92,0.10)";
const NEG_BG = "rgba(190,59,51,0.10)";
const NEUTRAL_BG = "rgba(2,125,252,0.10)";

/** KPI com delta semântico no padrão visual AZ. Use no slot `kpis` do DashboardScaffold (máx. 4). */
export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%",
  deltaHint,
  invertColor = false,
  hint,
  size = "md",
}: KpiCardProps) {
  const deltaText = (() => {
    if (delta == null || !Number.isFinite(delta)) return null;
    if (deltaUnit === "p.p.") return `${fmtSignedNum(delta, 1)} p.p.`;
    if (deltaUnit === "abs") return fmtSignedNum(delta, 0);
    return fmtSignedPct(delta, 1);
  })();

  // Direção literal do número; banda ±0,03 = "no zero" (azul AZ).
  const neutral = delta != null && Math.abs(delta) <= AZ_NEUTRAL_BAND;
  const up = delta != null && delta > 0;
  const isGood = invertColor ? !up : up;
  const badgeStyle = (() => {
    if (delta == null) return undefined;
    if (neutral) return { color: AZ_CHART.neutral, background: NEUTRAL_BG };
    return isGood
      ? { color: AZ_CHART.posText, background: POS_BG }
      : { color: AZ_CHART.negText, background: NEG_BG };
  })();

  return (
    <div className="flex flex-col rounded-xl border border-[#132960]/10 bg-white p-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`${size === "lg" ? "text-2xl" : "text-xl"} font-bold tabular-nums text-[#132960]`}
        >
          {value}
        </span>
        {unit ? <span className="text-xs text-zinc-500">{unit}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {deltaText ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
            style={badgeStyle}
          >
            {deltaText}
            {deltaHint ? <span className="ml-1 font-normal opacity-80">{deltaHint}</span> : null}
          </span>
        ) : null}
        {hint ? <span className="text-[10px] text-zinc-500">{hint}</span> : null}
      </div>
    </div>
  );
}
