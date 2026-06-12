"use client";

import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { PostMarkdownBody } from "@/components/blog/PostMarkdownBody";
import { htmlToMarkdownClient } from "@/lib/workspace/html-to-markdown-client";
import {
  formatPostCategoryLabel,
  getPostCategorySoftPillClasses,
} from "@/data/blog-categories";

export type PreviewData = {
  title: string;
  category: string;
  excerpt: string;
  coverImage: string;
  authorName: string;
  contentHtml: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  data: PreviewData;
};

/**
 * Painel lateral (Sheet) de pré-visualização do post. Para espelhar fielmente
 * o /blog, converte o HTML do editor para markdown (turndown com as MESMAS opções
 * do pipeline servidor) e renderiza com o MESMO componente público
 * (PostMarkdownBody, react-markdown) — exatamente o caminho de renderização do
 * post publicado, que parte do markdown em Post.content.
 * O envelope (cartão az-card, capa, pill de categoria, bloco de autor) reproduz
 * o layout de src/app/blog/[slug]/page.tsx sem reimplementar estilo de conteúdo.
 */
export function PostPreviewPanel({ open, onClose, data }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Converte só quando aberto (evita custo de turndown a cada tecla).
  const markdown = useMemo(() => {
    if (!open) return "";
    return htmlToMarkdownClient(data.contentHtml || "");
  }, [open, data.contentHtml]);

  // Esc fecha; trava o scroll do body; foca o botão fechar ao abrir.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Pré-visualização do texto">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-[#0b1c3f]/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-[#F3F5FB] shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#132960]/10 bg-white px-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#027DFC]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#027DFC]">
              Pré-visualização
            </span>
            <span className="text-sm text-[#132960]/55">Como ficará no blog</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar pré-visualização"
            className="rounded-md p-2 text-[#132960]/60 transition hover:bg-[#132960]/5 hover:text-[#132960]"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 text-[#132960] md:px-8">
          {data.coverImage ? (
            <div className="relative mb-6 aspect-[21/8] w-full overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview de URL remota variável */}
              <img
                src={data.coverImage}
                alt={data.title || "Capa do texto"}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <article className="az-card space-y-4 p-6 md:p-10">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getPostCategorySoftPillClasses(data.category)}`}
            >
              {formatPostCategoryLabel(data.category) || "Categoria"}
            </span>
            <h1 className="text-4xl font-semibold text-[#132960] md:text-5xl">
              {data.title || "Título do texto"}
            </h1>

            <div className="flex items-center gap-3 border-y border-[#132960]/10 py-3">
              <p className="text-sm text-zinc-500">
                {data.authorName || "Autor"} | {today}
              </p>
            </div>

            {markdown.trim() ? (
              <PostMarkdownBody markdown={markdown} />
            ) : (
              <p className="text-sm text-[#132960]/45">
                O conteúdo aparecerá aqui conforme você escreve.
              </p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
