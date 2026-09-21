import type { ReactNode } from "react";

import { AZ_BRAND, AZ_CHART, AZ_NEUTRAL_BAND } from "@/lib/az-chart-theme";

/**
 * Chip de estado do padrão COCKPIT: pill 11px navy com um ponto colorido. É
 * AQUI que o número dinâmico vive — nunca no título do card (§10). Promovido de
 * fiscal/v2/divida/shared.tsx para core em 21/09/2026.
 *
 * `tom` escolhe a cor do ponto pela direção literal do número (verde subiu,
 * azul na banda ±0,03, vermelho caiu) — ou passe `cor` direto.
 */
export type CockpitChipTom = "pos" | "neg" | "neutral" | "navy";

const COR_TOM: Record<CockpitChipTom, string> = {
  pos: AZ_CHART.pos,
  neg: AZ_CHART.neg,
  neutral: AZ_CHART.neutral,
  navy: AZ_BRAND.navy,
};

/** Tom pela direção literal de um número (banda ±0,03 = neutro). */
export function tomPorSinal(v: number | null | undefined): CockpitChipTom {
  if (v == null || !Number.isFinite(v)) return "navy";
  if (Math.abs(v) <= AZ_NEUTRAL_BAND) return "neutral";
  return v > 0 ? "pos" : "neg";
}

export function CockpitChip({
  cor,
  tom = "navy",
  children,
  title,
}: {
  cor?: string;
  tom?: CockpitChipTom;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#132960]/15 bg-[#132960]/5 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#132960]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor ?? COR_TOM[tom] }} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}
