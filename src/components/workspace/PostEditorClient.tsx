"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, Eye, LoaderCircle } from "lucide-react";
import { WorkspaceEditor } from "@/components/workspace/WorkspaceEditor";
import { PhotoField } from "@/components/workspace/PhotoField";
import { SubmitButton } from "@/components/workspace/SubmitButton";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import { PostPreviewPanel } from "@/components/workspace/PostPreviewPanel";
import {
  autosavePostDraftAction,
  deletePostAction,
  publishPostDirectAction,
  savePostDraftAction,
  submitPostForReviewAction,
} from "@/lib/workspace/post-actions";
import { POST_STATUS_LABELS } from "@/lib/workspace/posts";

type CategoryOption = { label: string; value: string };
type AuthorOption = { id: number; name: string };

type PostData = {
  id: number;
  title: string;
  slug: string;
  category: string;
  authorId: number | null;
  excerpt: string;
  coverImage: string;
  contentHtml: string;
  status: string;
  reviewNote: string | null;
};

type Props = {
  post: PostData | null;
  categoryOptions: CategoryOption[];
  authorOptions: AuthorOption[];
  defaultAuthorId: number | null;
  authorNameById: Record<number, string>;
  isAuthor: boolean;
  isLegacyPost: boolean;
  isLockedForAuthor: boolean;
  canPublishDirectly: boolean;
};

const AUTOSAVE_DELAY_MS = 3000;

type SaveStatus =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

function statusTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function PostEditorClient({
  post,
  categoryOptions,
  authorOptions,
  defaultAuthorId,
  authorNameById,
  isAuthor,
  isLegacyPost,
  isLockedForAuthor,
  canPublishDirectly,
}: Props) {
  // Estado controlado dos campos — necessário para o preview e o dirty-state.
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [category, setCategory] = useState(post?.category ?? categoryOptions[0]?.value ?? "");
  const [authorId, setAuthorId] = useState<number | null>(post?.authorId ?? defaultAuthorId);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [contentHtml, setContentHtml] = useState(post?.contentHtml ?? "");

  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [previewOpen, setPreviewOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const latestHtml = useRef(contentHtml);
  // Evita autosave logo na hidratação inicial (primeiro onChange do editor).
  const hydratedRef = useRef(false);

  // Autosave só faz sentido para post existente, não legado, e não bloqueado.
  const autosaveEnabled = Boolean(post) && !isLegacyPost && !isLockedForAuthor;

  const runAutosave = useCallback(async () => {
    if (!post) return;
    setStatus({ kind: "saving" });
    try {
      const result = await autosavePostDraftAction(post.id, latestHtml.current);
      if (result.ok) {
        dirtyRef.current = false;
        setStatus({ kind: "saved", at: new Date(result.savedAt) });
      } else {
        const messages: Record<string, string> = {
          legacy: "Autosave bloqueado: conteúdo bem menor que o original.",
          locked: "Post publicado — autosave desativado.",
          forbidden: "Sem permissão para editar este post.",
          invalid: "Não foi possível salvar.",
          author: "Autor inválido.",
          error: "Falha ao salvar. Tente novamente.",
        };
        setStatus({ kind: "error", message: messages[result.reason] ?? "Falha ao salvar." });
      }
    } catch {
      setStatus({ kind: "error", message: "Falha ao salvar. Tente novamente." });
    }
  }, [post]);

  const handleEditorChange = useCallback(
    (html: string) => {
      setContentHtml(html);
      latestHtml.current = html;

      // Ignora o disparo inicial (setContent na hidratação).
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        return;
      }

      dirtyRef.current = true;
      setStatus({ kind: "dirty" });

      if (!autosaveEnabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void runAutosave();
      }, AUTOSAVE_DELAY_MS);
    },
    [autosaveEnabled, runAutosave],
  );

  // Aviso de saída quando há alterações não salvas.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Limpa o timer pendente ao desmontar.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Após um submit manual (salvar/enviar/publicar), o React re-renderiza com os
  // dados novos vindos do servidor; marcamos como salvo e limpamos o dirty.
  function markManualSubmit() {
    dirtyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  const authorName =
    (authorId != null ? authorNameById[authorId] : undefined) ??
    authorOptions[0]?.name ??
    "Autor";

  return (
    <form action={savePostDraftAction} className="space-y-5">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[#132960]/65">Título</span>
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#132960]/65">Slug (SEO)</span>
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="gerado-automaticamente"
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[#132960]/65">Categoria</span>
          <select
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
          >
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[#132960]/65">Autor</span>
          <select
            name="authorId"
            required
            value={authorId ?? ""}
            onChange={(e) => setAuthorId(Number(e.target.value) || null)}
            disabled={isAuthor}
            className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC] disabled:opacity-60"
          >
            {authorOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-[#132960]/65">Resumo (excerpt)</span>
        <textarea
          name="excerpt"
          rows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-[#132960] outline-none focus:border-[#027DFC]"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[#132960]/65">Capa do texto</span>
        <PhotoField name="coverImage" defaultValue={coverImage} variant="cover" />
      </label>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#132960]/65">Conteúdo</p>
          <div className="flex items-center gap-3">
            <SaveStatusIndicator status={status} autosaveEnabled={autosaveEnabled} />
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#132960]/20 px-3 py-1.5 text-xs font-medium text-[#132960]/80 transition hover:bg-[#132960]/5"
            >
              <Eye aria-hidden className="h-3.5 w-3.5" />
              Pré-visualizar
            </button>
          </div>
        </div>

        {isLegacyPost ? (
          <p className="mb-2 rounded-md border border-amber-700/30 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Post legado precisa de migração: o conteúdo original (markdown) não pode ser
            carregado neste editor. Para evitar perda de dados, salvar com o editor vazio ou
            com texto bem menor que o original será bloqueado — cole o conteúdo completo no
            editor para migrar o post. O autosave fica desativado até a migração.
          </p>
        ) : null}

        <WorkspaceEditor
          name="contentHtml"
          initialHtml={contentHtml}
          onChange={handleEditorChange}
          disabled={isLockedForAuthor}
        />
      </div>

      {post ? (
        <p className="text-xs text-[#132960]/55">
          Status: {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS] ?? post.status}
          {post.reviewNote ? ` — ${post.reviewNote}` : ""}
        </p>
      ) : null}

      {isLockedForAuthor ? (
        <p className="rounded-md border border-[#9C2B24]/30 bg-[#9C2B24]/5 px-3 py-2 text-sm text-[#9C2B24]">
          Post publicado — peça à equipe editorial para abrir uma revisão.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton
          formAction={savePostDraftAction}
          disabled={isLockedForAuthor}
          onClick={markManualSubmit}
          className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0268d4] disabled:opacity-50"
        >
          Salvar rascunho
        </SubmitButton>
        {post ? (
          <>
            <SubmitButton
              formAction={submitPostForReviewAction}
              onClick={markManualSubmit}
              className="rounded-md border border-amber-700/40 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-700/10"
            >
              Enviar para revisão
            </SubmitButton>
            {canPublishDirectly ? (
              <SubmitButton
                formAction={publishPostDirectAction}
                onClick={markManualSubmit}
                className="rounded-md border border-[#166B47]/40 px-4 py-2 text-sm font-semibold text-[#166B47] transition hover:bg-[#166B47]/10"
              >
                Publicar direto
              </SubmitButton>
            ) : null}
            <ConfirmDialog
              title="Excluir texto"
              description={`"${post.title}" será apagado em definitivo e sai do blog imediatamente. Esta ação não pode ser desfeita.`}
              confirmLabel="Excluir texto"
              triggerLabel="Excluir"
              formAction={deletePostAction}
              triggerClassName="rounded-md border border-[#9C2B24]/40 px-4 py-2 text-sm text-[#9C2B24] transition hover:bg-[#9C2B24]/10"
            />
            {post.status === "APPROVED" ? (
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                className="rounded-md border border-[#132960]/25 px-4 py-2 text-sm text-[#132960]/70 hover:bg-[#132960]/5"
              >
                Ver no site
              </Link>
            ) : null}
          </>
        ) : null}
      </div>

      <PostPreviewPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={{
          title,
          category,
          excerpt,
          coverImage,
          authorName,
          contentHtml,
        }}
      />
    </form>
  );
}

function SaveStatusIndicator({
  status,
  autosaveEnabled,
}: {
  status: SaveStatus;
  autosaveEnabled: boolean;
}) {
  if (!autosaveEnabled && status.kind === "idle") return null;

  if (status.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#132960]/55">
        <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status.kind === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#166B47]">
        <Check aria-hidden className="h-3.5 w-3.5" />
        Salvo às {statusTime(status.at)}
      </span>
    );
  }
  if (status.kind === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
        <CloudOff aria-hidden className="h-3.5 w-3.5" />
        Alterações não salvas
      </span>
    );
  }
  if (status.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#9C2B24]" role="alert">
        <CloudOff aria-hidden className="h-3.5 w-3.5" />
        {status.message}
      </span>
    );
  }
  return null;
}
