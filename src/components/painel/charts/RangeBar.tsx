/**
 * Range bar compacta (§9 do PADRAO-VISUAL-GRAFICOS.md): trilho fino com
 * gradiente sutil, marcador azure na posição atual e mín/máx tabular nas
 * pontas, com microlabel ("range 12m"). Mesmo visual da referência do card
 * de cotação em /painel-economico/mercado/ativo/[ticker].
 *
 * Sem hooks — funciona em server e client components.
 */

export type RangeBarProps = {
  /** Mínimo do range (ex.: mín 12m). */
  min: number;
  /** Máximo do range (ex.: máx 12m). */
  max: number;
  /** Valor atual — vira a posição do marcador. */
  value: number;
  /** Formata mín/máx p/ exibição (ex.: (v) => fmtNum(v, 0)). */
  format: (v: number) => string;
  /** Microlabel acima do trilho. Default "range 12m". */
  label?: string;
  className?: string;
};

export function RangeBar({ min, max, value, format, label = "range 12m", className = "" }: RangeBarProps) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(value) || max <= min) {
    return null;
  }
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div
        className="relative mt-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#BE3B33]/25 via-zinc-200 to-[#1E8A5C]/25"
        role="img"
        aria-label={`Valor atual a ${pct.toFixed(0)}% do caminho entre ${format(min)} e ${format(max)} (${label})`}
      >
        <span
          aria-hidden
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#027DFC] shadow-md"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] tabular-nums text-zinc-500">
        <span>
          mín <span className="font-semibold text-[#132960]">{format(min)}</span>
        </span>
        <span>
          máx <span className="font-semibold text-[#132960]">{format(max)}</span>
        </span>
      </div>
    </div>
  );
}
