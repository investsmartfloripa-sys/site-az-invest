/**
 * /simuladores e os dossiês são páginas estáticas (fora do Next): o pré-carregamento do <Link>
 * pedia index.html?_rsc=… e recebia 404 — um erro no console em toda página. Links para elas
 * vão sem pré-carregamento.
 */
export function semPrefetch(href: string): false | undefined {
  return href.startsWith("/simuladores") || href.endsWith(".html") ? false : undefined;
}
