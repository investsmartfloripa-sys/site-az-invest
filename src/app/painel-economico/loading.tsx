/**
 * Skeleton do painel econômico. O layout do grupo (Header + PainelSectionShell)
 * permanece visível; este boundary cobre todas as rotas filhas do painel.
 */
export default function PainelEconomicoLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-8 w-72 max-w-full animate-pulse rounded-2xl bg-zinc-100" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-zinc-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
      <div className="h-[380px] animate-pulse rounded-2xl bg-zinc-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}
