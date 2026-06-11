import type { ReactNode } from "react";

import DataStamp from "@/components/painel/DataStamp";

/**
 * Card branco padrão p/ gráficos (PADRAO-VISUAL-GRAFICOS.md §6):
 * rounded-2xl, borda navy a 10%, shadow-sm, título NAVY bold, subtítulo,
 * slot de toolbar (AzSegmented/AzPeriodSelector) e rodapé com DataStamp.
 *
 * Server-safe: sem hooks. O conteúdo interativo (chart) vai em `children`.
 */
export type ChartCardProps = {
  /** Título do card — sempre navy bold (azul vivo é só de links/tab ativa). */
  title: string;
  /** Linha de apoio pequena abaixo do título. */
  subtitle?: string;
  /** Controles à direita do título (AzSegmented, AzPeriodSelector...). */
  toolbar?: ReactNode;
  /** Conteúdo do card (gráfico, tabela...). */
  children: ReactNode;
  /** Texto/JSX de rodapé à esquerda (fonte, metodologia curta). */
  footer?: ReactNode;
  /** Quando o pipeline gravou o JSON (DataStamp "Giro"). */
  stampGiro?: string | Date | null;
  /** Data da observação mais recente plotada (DataStamp "Dado"). */
  stampDado?: string | Date | null;
  /** id da section (âncora de navegação). */
  id?: string;
  className?: string;
};

/** Casca visual única dos cards de gráfico — use em todo chart novo. */
export function ChartCard({
  title,
  subtitle,
  toolbar,
  children,
  footer,
  stampGiro,
  stampDado,
  id,
  className = "",
}: ChartCardProps) {
  const hasStamp = stampGiro != null || stampDado != null;
  return (
    <section
      id={id}
      className={`flex w-full min-w-0 flex-col rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#132960] md:text-lg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>

      <div className="min-w-0 flex-1">{children}</div>

      {footer || hasStamp ? (
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 pt-1">
          <div className="text-[11px] text-zinc-500">{footer}</div>
          {hasStamp ? <DataStamp giro={stampGiro} dado={stampDado} /> : null}
        </div>
      ) : null}
    </section>
  );
}
