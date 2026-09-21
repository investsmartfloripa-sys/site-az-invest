import type { ReactNode } from "react";

import { MethodInfo } from "@/components/painel/core/MethodInfo";

/**
 * Divisor de seção do padrão COCKPIT (PADRAO-VISUAL-GRAFICOS.md §10): rótulo
 * de UMA linha em caixa alta + filete navy a 10% + (?) opcional com o texto
 * editorial. Substitui os blocos numerados "01 ·" com eyebrow/descrição do
 * template narrativo. Promovido do PainelRiscoFiscalV2 (cópia local) para
 * core em 21/09/2026, ao levar a área Atividade para o cockpit.
 *
 * Server-safe (o MethodInfo interno é client component).
 */
export function Divisor({ label, info, right }: { label: string; info?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
        {info ? <MethodInfo className="ml-1.5 align-middle">{info}</MethodInfo> : null}
      </span>
      <div className="h-px flex-1 bg-[#132960]/10" />
      {right ? <span className="text-[11px] text-zinc-500">{right}</span> : null}
    </div>
  );
}
