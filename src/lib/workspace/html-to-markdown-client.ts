import TurndownService from "turndown";

// Conversor HTML→markdown LEVE para o preview do editor no cliente. Usa só
// turndown (mesmas opções do pipeline servidor em html-content.ts) e evita
// puxar o sanitize-html (postcss/htmlparser2) para o bundle do editor.
//
// Seguro porque: (a) o HTML vem do próprio TipTap, restrito às tags permitidas;
// (b) é apenas pré-visualização. O SALVAMENTO real continua passando pelo
// pipeline servidor com sanitize-html — NÃO use isto para persistir conteúdo.
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

export function htmlToMarkdownClient(html: string) {
  if (!html.trim()) return "";
  return turndown.turndown(html);
}
