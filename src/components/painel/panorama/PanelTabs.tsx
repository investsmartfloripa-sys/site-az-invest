"use client";

import type { LucideIcon } from "lucide-react";

export type PanelTabItem<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

type Props<T extends string> = {
  tabs: PanelTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** Cor de accent do estado ativo (borda + preenchimento a ~10%). Default navy. */
  accent?: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Grupo de abas estilo "chip" para alternar gráficos/visões nos blocos do painel.
 *
 * Substitui as antigas abas "underline" (só texto + linha embaixo), que vários
 * leitores não percebiam ser clicáveis. Aqui CADA aba tem borda + preenchimento
 * semitransparente — o mesmo affordance dos chips usados no resto do site — então
 * fica claro que é um botão. O ativo recebe a cor de accent do bloco (azul, verde,
 * etc.) num fundo a ~10% de opacidade. Ícones opcionais reforçam a leitura.
 */
export function PanelTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  accent = "#132960",
  size = "md",
  className = "",
}: Props<T>) {
  const pad =
    size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs md:text-sm";

  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex flex-wrap gap-1.5 ${className}`}>
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={
              active
                ? { borderColor: accent, backgroundColor: `${accent}1A`, color: accent }
                : undefined
            }
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold transition ${pad} ${
              active
                ? "shadow-sm"
                : "border-[#132960]/20 bg-[#132960]/[0.04] text-[#132960]/75 hover:border-[#132960]/40 hover:bg-[#132960]/[0.07] hover:text-[#132960]"
            }`}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden /> : null}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
