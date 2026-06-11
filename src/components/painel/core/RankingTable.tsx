import { AZ_CHART, variationText } from "@/lib/az-chart-theme";
import { fmtSignedPct } from "@/lib/format-br";

/**
 * Ranking padrão Datawrapper "table with bars" — generalização do
 * SectorsPanel (PADRAO-VISUAL-GRAFICOS.md §7): mini-barra de fundo
 * proporcional a 10% de opacidade (verde/vermelho), valor com SINAL na cor
 * de texto da família e dot colorido no header.
 *
 * Server-safe: sem hooks. Para Top/Bottom lado a lado, renderize duas
 * instâncias em um grid 2 colunas.
 */
export type RankingTableRow = {
  /** Nome exibido (truncue antes se necessário — o componente não quebra linha). */
  label: string;
  /** Valor da linha (geralmente variação %). Define cor e largura da mini-barra. */
  value: number;
  /** Nota pequena ao lado do nome (ex.: ticker, peso). */
  hint?: string;
};

export type RankingTableProps = {
  /** Título do bloco (ex.: "Top 10"). */
  title: string;
  /** Cor do dot do header — default verde se a maioria sobe, vermelho se cai. */
  dotColor?: string;
  rows: RankingTableRow[];
  /** Formata o valor — default `fmtSignedPct(v, 2)` (sinal explícito sempre). */
  valueFmt?: (v: number) => string;
  /** Máximo absoluto p/ normalizar as barras — default: máx. das próprias linhas. Fixe entre tabelas irmãs p/ escala comparável. */
  maxAbs?: number;
};

const POS_BG = "rgba(30,138,92,0.10)";
const NEG_BG = "rgba(190,59,51,0.10)";

/** Tabela de ranking com mini-barras de fundo — padrão único p/ tops/bottoms. */
export function RankingTable({
  title,
  dotColor,
  rows,
  valueFmt = (v) => fmtSignedPct(v, 2),
  maxAbs,
}: RankingTableProps) {
  const max = Math.max(0.0001, maxAbs ?? Math.max(...rows.map((r) => Math.abs(r.value)), 0));
  const ups = rows.filter((r) => r.value >= 0).length;
  const headerDot = dotColor ?? (ups * 2 >= rows.length ? AZ_CHART.pos : AZ_CHART.neg);

  return (
    <div className="rounded-xl border border-[#132960]/10 bg-zinc-50/50 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: headerDot }} />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">Sem dados.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => {
            const neg = r.value < 0;
            const widthPct = Math.min(100, (Math.abs(r.value) / max) * 100);
            return (
              <li key={`${r.label}-${i}`} className="relative overflow-hidden rounded-md">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${widthPct}%`, backgroundColor: neg ? NEG_BG : POS_BG }}
                />
                <span className="relative flex items-center justify-between gap-2 px-1.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-[#132960]">
                    {r.label}
                    {r.hint ? <span className="ml-1 text-[10px] text-zinc-400">{r.hint}</span> : null}
                  </span>
                  <span
                    className="shrink-0 font-semibold tabular-nums"
                    style={{ color: variationText(r.value, 0) }}
                  >
                    {valueFmt(r.value)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
