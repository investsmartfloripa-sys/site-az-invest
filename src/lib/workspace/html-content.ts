import DOMPurify from "isomorphic-dompurify";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });
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
