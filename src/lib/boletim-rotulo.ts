import { BOLETIM_KICKER } from "@/data/blog-categories";
import { periodoLegivel } from "@/lib/periodicos-releases";
import { INDICADOR_LABEL, type ChartIndicador } from "@/lib/publisher/chart-catalog";

/** Indicador da divulgação, pelo prefixo do slug que o Publisher grava. */
export function indicadorDoSlug(slug: string): ChartIndicador | null {
  if (slug.startsWith("ipca-")) return "ipca";
  if (slug.startsWith("igpm-")) return "igpm";
  return null;
}

/**
 * "IPCA · julho de 2026". O mês de referência vem do slug (`ipca-2026-07`);
 * sem esse padrão, cai na data de publicação do post.
 */
export function rotuloBoletim(post: { slug: string; date: string }, ind = indicadorDoSlug(post.slug)): string {
  const rotulo = ind ? INDICADOR_LABEL[ind] : BOLETIM_KICKER;
  const mesRef = /-(\d{4}-\d{2})(?:-|$)/.exec(post.slug)?.[1];
  return `${rotulo} · ${mesRef ? periodoLegivel(mesRef) : post.date}`;
}
