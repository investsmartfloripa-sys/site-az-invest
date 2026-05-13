import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  /** Slot superior direito (ex.: toggles, filtros, link "Ver tudo") */
  toolbar?: ReactNode;
  /** Rodape pequeno (ex.: "Atualizado em ...") */
  footer?: ReactNode;
  /** Padding interno do corpo. Default = "p-4". Use "p-0" para tabelas full-bleed. */
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Wrapper visual padronizado dos cards da aba Mercado.
 *
 * Mantem o mesmo perfil de StaticChartCard:
 *  - rounded-2xl border border-[#132960]/15 bg-white p-4 shadow-sm (no wrapper externo)
 *  - h2 text-lg font-semibold text-[#027DFC] (titulo)
 *  - badge pill cinza
 *  - subtitle text-sm text-zinc-600
 */
export function MarketCard({
  title,
  subtitle,
  badge,
  toolbar,
  footer,
  bodyClassName = "p-4 pt-3",
  className = "",
  children,
}: Props) {
  return (
    <article
      className={`rounded-2xl border border-[#132960]/15 bg-white shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-[#027DFC]">{title}</h2>
            {badge ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-sm text-zinc-600">{subtitle}</p> : null}
        </div>
        {toolbar ? <div className="flex shrink-0 flex-wrap gap-2">{toolbar}</div> : null}
      </header>

      <div className={bodyClassName}>{children}</div>

      {footer ? (
        <footer className="border-t border-[#132960]/10 px-4 py-2 text-xs italic text-zinc-500">
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
