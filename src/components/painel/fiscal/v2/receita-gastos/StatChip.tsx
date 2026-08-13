import type { ReactNode } from "react";

/**
 * Chip de estado do padrão cockpit (§10 do PADRAO-VISUAL): o título do card é
 * FIXO e técnico; o número dinâmico vive aqui, ao lado do título (toolbar).
 * Tons: pos (verde), neg (vermelho), neutral (navy).
 */
export function StatChip({ tone = "neutral", children }: { tone?: "pos" | "neg" | "neutral"; children: ReactNode }) {
  const cls =
    tone === "pos"
      ? "border-[#1E8A5C]/30 bg-[#1E8A5C]/5 text-[#1E8A5C]"
      : tone === "neg"
        ? "border-[#BE3B33]/30 bg-[#BE3B33]/5 text-[#BE3B33]"
        : "border-[#132960]/20 bg-[#132960]/5 text-[#132960]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums ${cls}`}>
      {children}
    </span>
  );
}
