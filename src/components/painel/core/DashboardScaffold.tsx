import type { ReactNode } from "react";

/**
 * Espinha dorsal NARRATIVA de todo dashboard novo de economia:
 * header → manchete (prosa) → até 4 KPIs → gráfico-âncora → blocos
 * numerados ("01 ·" com filete) → ficha técnica colapsável.
 *
 * A ordem é deliberada: leitura rápida em cima (manchete + KPIs + âncora),
 * esmiuçamento profissional abaixo (blocos), metodologia no rodapé.
 *
 * Server-safe: sem hooks — os charts client entram pelos slots.
 */
export type DashboardBloco = {
  /** Âncora opcional (id da section). */
  id?: string;
  /** Eyebrow em caixa alta acima do título (ex.: "Mercado de trabalho"). */
  eyebrow?: string;
  /** Título do bloco — numerado automaticamente ("01 · Título"). */
  titulo: string;
  /** Nota curta de contexto sob o título. */
  descricao?: string;
  children: ReactNode;
};

export type DashboardScaffoldProps = {
  header: {
    titulo: string;
    /** Período de referência do dado (ex.: "Referência: abr/2026"). */
    referencia?: string;
    subtitulo?: string;
    /** Slot à direita do header (badge de fonte, ações). */
    rightSlot?: ReactNode;
  };
  /** Manchete em PROSA: a leitura do mês em 1-3 frases (o "so what"). */
  manchete?: ReactNode;
  /** Até 4 KpiCard — excedentes são ignorados p/ preservar a leitura rápida. */
  kpis?: ReactNode[];
  /** Gráfico-âncora: O gráfico que conta a história principal. */
  anchor?: ReactNode;
  /** Blocos numerados de esmiuçamento (01 ·, 02 ·, ...). */
  blocos?: DashboardBloco[];
  /** Conteúdo da ficha técnica (fontes, séries, metodologia) — vira <details>. */
  fichaTecnica?: ReactNode;
};

const MAX_KPIS = 4;

/** Template narrativo padrão dos dashboards de economia AZ. */
export function DashboardScaffold({
  header,
  manchete,
  kpis,
  anchor,
  blocos = [],
  fichaTecnica,
}: DashboardScaffoldProps) {
  const kpisVisiveis = (kpis ?? []).slice(0, MAX_KPIS);

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl border border-[#132960]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#132960]">{header.titulo}</h1>
            {header.subtitulo ? <p className="mt-1 text-sm text-zinc-600">{header.subtitulo}</p> : null}
            {header.referencia ? <p className="mt-2 text-xs text-zinc-500">{header.referencia}</p> : null}
          </div>
          {header.rightSlot}
        </div>
        {manchete ? (
          <p className="mt-4 border-l-4 border-[#027DFC] pl-3 text-sm leading-relaxed text-zinc-800 md:text-base">
            {manchete}
          </p>
        ) : null}
      </header>

      {kpisVisiveis.length > 0 ? (
        <div className={`grid gap-3 grid-cols-2 ${kpisVisiveis.length > 2 ? "lg:grid-cols-4" : ""}`}>
          {kpisVisiveis.map((kpi, i) => (
            <div key={i} className="min-w-0">
              {kpi}
            </div>
          ))}
        </div>
      ) : null}

      {anchor ? <div className="min-w-0">{anchor}</div> : null}

      {blocos.map((bloco, i) => {
        const numero = String(i + 1).padStart(2, "0");
        return (
          <section key={bloco.id ?? bloco.titulo} id={bloco.id} className="border-l-4 border-[#132960]/15 pl-4">
            {bloco.eyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{bloco.eyebrow}</p>
            ) : null}
            <h2 className="mt-0.5 text-lg font-bold text-[#132960]">
              <span className="mr-1 tabular-nums text-[#027DFC]">{numero} ·</span>
              {bloco.titulo}
            </h2>
            {bloco.descricao ? <p className="mt-1 text-xs text-zinc-500">{bloco.descricao}</p> : null}
            <div className="mt-3 min-w-0">{bloco.children}</div>
          </section>
        );
      })}

      {fichaTecnica ? (
        <details className="group rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer select-none text-sm font-semibold text-[#132960] marker:text-[#027DFC]">
            Ficha técnica — fontes e metodologia
          </summary>
          <div className="mt-3 text-xs leading-relaxed text-zinc-600">{fichaTecnica}</div>
        </details>
      ) : null}
    </div>
  );
}
