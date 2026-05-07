"use client";

import { useCallback, useRef, useState } from "react";

const UPLOAD = "/api/area-restrita/blog-upload";

type NovaPostagemBlogFieldsProps = {
  uploadConfigured: boolean;
};

function useMarkdownEditor(
  value: string,
  setValue: (v: string) => void,
  ref: React.RefObject<HTMLTextAreaElement | null>,
) {
  const wrap = useCallback(
    (open: string, close: string) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const sel = value.slice(start, end);
      const next = `${value.slice(0, start)}${open}${sel}${close}${value.slice(end)}`;
      setValue(next);
      const cStart = start + open.length;
      const cEnd = cStart + sel.length;
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(cStart, cEnd);
      });
    },
    [value, setValue, ref],
  );

  const insert = useCallback(
    (text: string) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
      setValue(next);
      const pos = start + text.length;
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [value, setValue, ref],
  );

  return { wrap, insert };
}

export function NovaPostagemBlogFields({ uploadConfigured }: NovaPostagemBlogFieldsProps) {
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const { wrap, insert } = useMarkdownEditor(content, setContent, taRef);

  const runUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(UPLOAD, { method: "POST", body: fd });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Falha no envio");
    }
    if (!data.url) throw new Error("Resposta sem URL");
    return data.url;
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!uploadConfigured) {
      setError("Defina BLOB_READ_WRITE_TOKEN no servidor para anexar imagens.");
      return;
    }
    setError(null);
    setUploadingCover(true);
    try {
      const url = await runUpload(file);
      setCoverImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleInlineFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!uploadConfigured) {
      setError("Defina BLOB_READ_WRITE_TOKEN no servidor para anexar imagens no texto.");
      return;
    }
    setError(null);
    setUploadingInline(true);
    try {
      const url = await runUpload(file);
      const alt = file.name.replace(/\.[^.]+$/, "") || "Imagem";
      insert(`\n\n![${alt}](${url})\n\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploadingInline(false);
    }
  };

  const onLink = () => {
    const url = window.prompt("URL do link (https://... ou caminho interno /blog)");
    if (!url?.trim()) return;
    wrap("[", `](${url.trim()})`);
  };

  const onBulletList = () => {
    insert("- ");
  };

  const toolBtn =
    "rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50";

  return (
    <>
      <div className="flex flex-col gap-2 md:col-span-2">
        <span className="text-xs font-medium text-zinc-600">Imagem de capa (opcional)</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="coverImage"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="URL da imagem de capa ou use anexar"
            className="h-10 min-w-[200px] flex-1 rounded-md border border-zinc-300 px-3 text-sm"
            autoComplete="off"
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleCoverFile}
          />
          <button
            type="button"
            disabled={uploadingCover}
            className="h-10 shrink-0 rounded-md border border-[#132960] bg-[#132960]/5 px-3 text-sm font-semibold text-[#132960] disabled:opacity-50"
            onClick={() => coverInputRef.current?.click()}
          >
            {uploadingCover ? "Enviando…" : "Anexar capa"}
          </button>
        </div>
        {!uploadConfigured ? (
          <p className="text-xs text-amber-800">
            Anexos automaticos exigem <code className="rounded bg-amber-100 px-1">BLOB_READ_WRITE_TOKEN</code> no
            servidor e <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_BLOB_BASE_URL</code> no deploy. Sem
            isso, cole a URL da imagem.
          </p>
        ) : null}
      </div>

      <input
        name="excerpt"
        placeholder="Resumo (opcional)"
        className="h-10 rounded-md border border-zinc-300 px-3 text-sm md:col-span-2"
      />

      <div className="flex flex-col gap-2 md:col-span-2">
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-zinc-300 bg-zinc-50 px-2 py-1.5">
          <button type="button" className={toolBtn} onClick={() => wrap("**", "**")} title="Negrito">
            Negrito
          </button>
          <button type="button" className={toolBtn} onClick={() => wrap("*", "*")} title="Italico">
            Italico
          </button>
          <button type="button" className={toolBtn} onClick={onBulletList} title="Lista">
            Lista
          </button>
          <button type="button" className={toolBtn} onClick={onLink} title="Link">
            Link
          </button>
          <input
            ref={inlineInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleInlineFile}
          />
          <button
            type="button"
            disabled={uploadingInline}
            className={toolBtn}
            onClick={() => inlineInputRef.current?.click()}
            title="Inserir imagem no texto"
          >
            {uploadingInline ? "Enviando…" : "Imagem no texto"}
          </button>
        </div>
        <textarea
          ref={taRef}
          name="content"
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Conteudo do post (Markdown: use a barra acima para negrito, imagens, etc.)"
          className="min-h-48 rounded-b-md rounded-t-none border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-zinc-500">
          Dica: selecione um trecho e clique em Negrito ou Italico para envolver. Use &quot;Imagem no texto&quot; para
          anexar e inserir automaticamente no artigo.
        </p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </>
  );
}
