/**
 * Barra de DIFUSÃO / status geral do cockpit (§10): barra empilhada h-7 com a
 * contagem de itens em cada segmento (ex.: "dos 12 setores da oferta, 5 sobem ·
 * 2 estáveis · 5 caem no QoQ SA") + legenda com as contagens e uma nota fixa.
 * Generalização neutra da DistribuicaoBar do cockpit fiscal (que conta níveis
 * de risco): aqui cada segmento traz o próprio rótulo, contagem e cor.
 *
 * Server-safe.
 */
export type DifusaoSegmento = { label: string; count: number; color: string };

export function DifusaoBar({
  segmentos,
  nota,
  titulo,
}: {
  segmentos: readonly DifusaoSegmento[];
  /** Nota fixa à direita da legenda (ex.: "É contagem, não nota — 12 setores"). */
  nota?: string;
  /** Rótulo pequeno em caixa alta acima da barra (ex.: "Difusão setorial · QoQ SA"). */
  titulo?: string;
}) {
  const total = segmentos.reduce((a, s) => a + s.count, 0);
  if (total === 0) return null;
  return (
    <div>
      {titulo ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{titulo}</p>
      ) : null}
      <div className="flex h-7 w-full overflow-hidden rounded-lg border border-zinc-200">
        {segmentos.map((s) => {
          if (s.count === 0) return null;
          const pct = (s.count / total) * 100;
          return (
            <div
              key={s.label}
              className="flex items-center justify-center text-[11px] font-bold text-white"
              style={{ width: `${pct}%`, background: s.color }}
              title={`${s.label}: ${s.count} de ${total}`}
            >
              {pct > 8 ? s.count : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
        {segmentos
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}: <strong>{s.count}</strong>
            </span>
          ))}
        {nota ? <span className="text-zinc-400">{nota}</span> : null}
      </div>
    </div>
  );
}
