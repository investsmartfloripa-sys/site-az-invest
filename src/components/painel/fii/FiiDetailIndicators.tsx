import type { FiiDetailIndicators as Indicators } from "@/lib/painel-fii";

function formatBRL(value: number | null | undefined, frac = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}
function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}
function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR");
}
function formatRatio(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(3);
}

export function FiiDetailIndicators({ indicators }: { indicators: Indicators }) {
  const items: Array<{ label: string; value: string; help?: string }> = [
    { label: "Valor Patrimonial / Cota", value: formatBRL(indicators.vp_per_cota, 2) },
    { label: "DY CAGR 3 anos", value: formatPct(indicators.dy_cagr_3y_pct), help: "Taxa anualizada de crescimento da soma anual de dividendos nos últimos 3 anos." },
    { label: "P/VP", value: formatRatio(indicators.pvp) },
    { label: "Valor CAGR 3 anos", value: formatPct(indicators.valor_cagr_3y_pct), help: "Variação anualizada da cotação nos últimos 3 anos (price-only, sem dividendos reinvestidos)." },
    { label: "Nº de cotistas", value: formatInt(indicators.num_cotistas) },
    { label: "Participação IFIX", value: formatPct(indicators.ifix_weight_pct) },
  ];

  return (
    <section
      aria-label="Indicadores"
      className="rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm md:p-6"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Indicadores</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-baseline justify-between border-b border-zinc-100 pb-2" title={it.help}>
            <dt className={`text-xs ${it.help ? "cursor-help" : ""} text-zinc-600`}>{it.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-[#132960]">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
