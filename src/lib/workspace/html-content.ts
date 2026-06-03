import sanitize from "sanitize-html";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

// sanitize-html e' JS puro (sem jsdom) — funciona no runtime serverless da Vercel.
// O isomorphic-dompurify anterior carregava jsdom no servidor e quebrava com
// ERR_REQUIRE_ESM (html-encoding-sniffer), derrubando o "Salvar rascunho".
const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h2", "h3", "ul", "ol", "li", "blockquote",
    "a", "img", "code", "pre", "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitize.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeHtml(html: string) {
  return sanitize(html, SANITIZE_OPTIONS);
}

export function htmlToMarkdown(html: string) {
  const clean = sanitizeHtml(html);
  if (!clean.trim()) return "";
  return turndown.turndown(clean);
}

export function preparePostContent(contentHtml: string) {
  const html = sanitizeHtml(contentHtml);
  const content = htmlToMarkdown(html);
  return { contentHtml: html, content };
}
