/**
 * Skeleton exibido durante a navegação entre páginas do workspace:
 * título, grade de cards e tabela — o esqueleto cobre os dois layouts
 * mais comuns (dashboard com cards e listagens em tabela).
 */
export default function WorkspaceLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando página" className="animate-pulse">
      {/* Título e subtítulo */}
      <div className="h-7 w-48 rounded-md bg-[#132960]/10" />
      <div className="mt-2 h-4 w-72 max-w-full rounded-md bg-[#132960]/8" />

      {/* Cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#132960]/10 bg-white px-4 py-5 shadow-sm"
          >
            <div className="h-3 w-24 rounded bg-[#132960]/10" />
            <div className="mt-3 h-8 w-16 rounded bg-[#132960]/10" />
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#132960]/10 bg-white shadow-sm">
        <div className="border-b border-[#132960]/10 bg-[#F3F5FB] px-4 py-3">
          <div className="h-3 w-40 rounded bg-[#132960]/10" />
        </div>
        <div className="divide-y divide-[#132960]/8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-4 w-1/3 rounded bg-[#132960]/10" />
              <div className="h-4 w-20 rounded bg-[#132960]/8" />
              <div className="ml-auto h-4 w-24 rounded bg-[#132960]/8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
