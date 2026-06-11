"use client";

import { addDaysUTC } from "@/lib/format-br";

/**
 * Toggle de janela temporal — pílulas no padrão visual AZ (mesma estética do
 * AzPeriodSelector): 1M/3M/6M/YTD/1A/5A/Máx.
 *
 * API externa PRESERVADA (`value`/`onChange`, `TIME_WINDOW_OPTIONS`,
 * `type TimeWindow`): consumidores existentes (FiiMacroCharts, AcoesValuation)
 * compilam sem mudança e herdam as novas opções/estética. Os ids legados
 * "7d"/"5d" seguem no TIPO por compatibilidade, mas saíram da UI — em série
 * diária o "1D" plotava só 2 pontos (inútil).
 */

/** Ids aceitos. "7d"/"5d" são legados (fora da UI), mantidos só p/ compatibilidade de tipo. */
export type TimeWindow = "7d" | "5d" | "30d" | "3m" | "6m" | "ytd" | "1y" | "5y" | "max";

/** Aproximação de YTD p/ consumidores que só leem `days`: dias desde 1º/jan UTC de hoje. */
function ytdApproxDays(): number {
  const now = Date.now();
  const jan1 = Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  return Math.max(1, Math.ceil((now - jan1) / 86_400_000));
}

/**
 * Opções exibidas. `days` alimenta o corte `last - days*86400000` dos
 * consumidores existentes: YTD é dinâmico (getter) e Máx = Infinity (corte em
 * -Infinity ⇒ série inteira). Para corte EXATO relativo ao fim da série
 * (YTD = 1º/jan do ano do último ponto), prefira `timeWindowStartIso`.
 */
export const TIME_WINDOW_OPTIONS: ReadonlyArray<{ id: TimeWindow; label: string; days: number }> = [
  { id: "30d", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 91 },
  { id: "6m", label: "6M", days: 183 },
  {
    id: "ytd",
    label: "YTD",
    get days() {
      return ytdApproxDays();
    },
  },
  { id: "1y", label: "1A", days: 365 },
  { id: "5y", label: "5A", days: 365 * 5 },
  { id: "max", label: "Máx", days: Number.POSITIVE_INFINITY },
];

// Janelas legadas que podem chegar via estado antigo — nunca pela UI nova.
const LEGACY_DAYS: Partial<Record<TimeWindow, number>> = { "7d": 2, "5d": 9 };

/**
 * Data ISO de INÍCIO (inclusive) da janela, relativa ao ÚLTIMO ponto da série.
 * Trata YTD exato (1º/jan do ano do último ponto) e devolve null p/ "Máx"
 * (sem corte). Aritmética 100% UTC (`addDaysUTC`).
 */
export function timeWindowStartIso(lastIso: string, windowId: TimeWindow): string | null {
  if (windowId === "max") return null;
  if (windowId === "ytd") return `${lastIso.slice(0, 4)}-01-01`;
  const days =
    TIME_WINDOW_OPTIONS.find((o) => o.id === windowId)?.days ?? LEGACY_DAYS[windowId] ?? 365;
  if (!Number.isFinite(days)) return null;
  return addDaysUTC(lastIso, -days);
}

type Props = {
  value: TimeWindow;
  onChange: (value: TimeWindow) => void;
  className?: string;
};

export function TimeWindowToggle({ value, onChange, className }: Props) {
  return (
    <div
      role="group"
      aria-label="Janela temporal"
      className={"inline-flex flex-wrap items-center gap-1 " + (className ?? "")}
    >
      {TIME_WINDOW_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-[#027DFC] text-white"
                : "border border-[#132960]/20 bg-white text-[#132960] hover:bg-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
