/**
 * Legenda em HTML, embaixo do gráfico, para as linhas e faixas de referência (média, ±1 dp, régua de
 * risco). Os rótulos desenhados dentro do gráfico caíam em cima da série ou uns dos outros e eram
 * cortados na borda direita ("mé", "±1 dp" — revisão de 12/11/2026). Server-safe, sem hooks.
 */
export type ItemLegendaRef = {
  /** "tracejada" (linha de referência), "linha" (contínua) ou "faixa" (área sombreada). */
  tipo: "tracejada" | "linha" | "faixa";
  cor: string;
  texto: string;
};

export function LegendaRef({ itens, className = "" }: { itens: ItemLegendaRef[]; className?: string }) {
  if (itens.length === 0) return null;
  return (
    <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 ${className}`}>
      {itens.map((it) => (
        <span key={`${it.tipo}-${it.texto}`} className="inline-flex items-center gap-1.5">
          {it.tipo === "faixa" ? (
            <span className="h-2.5 w-4 rounded-sm" style={{ background: it.cor, opacity: 0.25 }} aria-hidden />
          ) : (
            <svg width="18" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={it.cor}
                strokeWidth="1.5"
                strokeDasharray={it.tipo === "tracejada" ? "4 3" : undefined}
              />
            </svg>
          )}
          {it.texto}
        </span>
      ))}
    </div>
  );
}
