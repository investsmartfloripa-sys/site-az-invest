"use client";

/**
 * Toggle de janela temporal — botões em pílulas pra escolher horizonte.
 * Componente reutilizável: na próxima conversa, mesma estética será padronizada
 * em outros gráficos do site.
 */

export type TimeWindow = "7d" | "5d" | "30d" | "6m" | "1y" | "5y";

export const TIME_WINDOW_OPTIONS: ReadonlyArray<{ id: TimeWindow; label: string; days: number }> = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "5d", label: "5 dias úteis", days: 7 }, // 5 pregões ≈ 7 dias corridos
  { id: "30d", label: "30 dias", days: 30 },
  { id: "6m", label: "6M", days: 183 },
  { id: "1y", label: "1A", days: 365 },
  { id: "5y", label: "5A", days: 365 * 5 },
];

type Props = {
  value: TimeWindow;
  onChange: (value: TimeWindow) => void;
  className?: string;
};

export function TimeWindowToggle({ value, onChange, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Janela temporal"
      className={
        "inline-flex flex-wrap items-center gap-1 rounded-full border border-[#132960]/15 bg-zinc-50 p-1 text-[11px] font-semibold " +
        (className ?? "")
      }
    >
      {TIME_WINDOW_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={
              "rounded-full px-3 py-1 transition " +
              (active
                ? "bg-[#132960] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-[#132960]")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
