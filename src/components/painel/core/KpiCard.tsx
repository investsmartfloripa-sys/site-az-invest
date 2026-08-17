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
  /**
   * Casas decimais do delta. Default 1 — suba quando a grandeza for pequena a
   * ponto de 1 casa virar "+0,0" e contradizer outro card da mesma tela (ex.:
   * surpresa inflacionária, na casa dos centésimos de p.p.).
   */
  deltaDec?: number;
  /** Sufixo de contexto do delta dentro do badge (ex.: "vs mês ant."). */
  deltaHint?: string;
  /** true quando QUEDA é boa (desocupação, inflação): inverte verde/vermelho. */
  invertColor?: boolean;
  /** Nota auxiliar pequena abaixo do valor. */
  hint?: string;
  /** md (default), lg (KPI de destaque) ou sm (compacto, p/ fila de 4+). */
  size?: "md" | "lg" | "sm";
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
  deltaDec = 1,
  invertColor = false,
  hint,
  size = "md",
}: KpiCardProps) {
  const deltaText = (() => {
    if (delta == null || !Number.isFinite(delta)) return null;
    if (deltaUnit === "p.p.") return `${fmtSignedNum(delta, deltaDec)} p.p.`;
    if (deltaUnit === "abs") return fmtSignedNum(delta, 0);
    return fmtSignedPct(delta, deltaDec);
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

  // `sm`: rótulo e valor na MESMA linha, padding menor e sem quebra — a fila de
  // 4 KPIs deixava metade do card vazia à direita (relatório do editor, ago/2026).
  const sm = size === "sm";
  return (
    <div
      className={`flex flex-col rounded-xl border border-[#132960]/10 bg-white shadow-sm ${sm ? "px-3 py-2" : "p-3"}`}
    >
      <div className={`${sm ? "text-[10px]" : "text-[11px]"} uppercase tracking-wide text-zinc-500`}>{label}</div>
      <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${sm ? "" : "mt-1"}`}>
        <span
          className={`${size === "lg" ? "text-2xl" : sm ? "text-lg" : "text-xl"} font-bold tabular-nums text-[#132960]`}
        >
          {value}
        </span>
        {unit ? <span className="text-xs text-zinc-500">{unit}</span> : null}
        {sm && deltaText ? (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style={badgeStyle}>
            {deltaText}
          </span>
        ) : null}
      </div>
      {sm ? (
        deltaHint || hint ? (
          <div className="text-[10px] leading-tight text-zinc-500">
            {[deltaHint, hint].filter(Boolean).join(" · ")}
          </div>
        ) : null
      ) : (
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
      )}
    </div>
  );
}
