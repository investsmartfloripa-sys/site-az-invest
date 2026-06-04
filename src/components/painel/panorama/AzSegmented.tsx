"use client";

import { useEffect, useState } from "react";

export type AzSegmentedOption = { id: string; label: string };

type Props = {
  options: AzSegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** sm = controles de card (default); md = tabs maiores. */
  size?: "sm" | "md";
};

/**
 * Segmented control padrao AZ (ver PADRAO-VISUAL-GRAFICOS.md §controles):
 * grid de colunas iguais com indicador navy deslizante (translateX puro,
 * sem medicao) — padrao Robinhood/TradingView pesquisado em 2026-06-04.
 * Container #eef2f8 · indicador #132960 + sombra navy · ativo branco.
 */
export function AzSegmented({ options, value, onChange, ariaLabel, size = "sm" }: Props) {
  const activeIdx = Math.max(0, options.findIndex((o) => o.id === value));
  const [ready, setReady] = useState(false);

  // Evita o indicador "voar" da posicao 0 no primeiro paint.
  useEffect(() => {
    setReady(true);
  }, []);

  const pad = size === "sm" ? "py-1 text-[11px]" : "py-1.5 text-xs";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="relative rounded-lg bg-[#eef2f8] p-0.5"
      style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-0.5 top-0.5 left-0.5 rounded-md bg-[#132960] ${
          ready ? "transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" : ""
        }`}
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(calc(${activeIdx} * 100%))`,
          boxShadow: "0 1px 4px rgba(19,41,96,0.28)",
        }}
      />
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 select-none whitespace-nowrap rounded-md px-2.5 text-center font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#027DFC] ${pad} ${
              active ? "text-white" : "text-[#132960]/70 hover:bg-[#132960]/[0.08] hover:text-[#132960]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
