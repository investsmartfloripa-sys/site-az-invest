"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Heading2,
  Heading3,
  Undo2,
} from "lucide-react";
import { uploadImage } from "@/components/workspace/image-upload";
import { EditorDialog } from "@/components/workspace/EditorDialog";

type Props = {
  name: string;
  initialHtml?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  /** Bloqueia toda a edição (ex.: post APPROVED para AUTHOR). */
  disabled?: boolean;
};

const WORDS_PER_MINUTE = 200;

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function readingTimeLabel(words: number) {
  if (words === 0) return "menos de 1 min de leitura";
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${minutes} min de leitura`;
}

export function WorkspaceEditor({
  name,
  initialHtml = "",
  placeholder = "Comece a escrever…",
  onChange,
  disabled = false,
}: Props) {
  const [html, setHtml] = useState(initialHtml || "<p></p>");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [linkDialog, setLinkDialog] = useState<{
    open: boolean;
    url: string;
    text: string;
    newTab: boolean;
    /** Há texto selecionado: aplica link sobre ele (não usa o campo "texto"). */
    hasSelection: boolean;
  }>({ open: false, url: "", text: "", newTab: true, hasSelection: false });

  const [imageDialog, setImageDialog] = useState<{
    open: boolean;
    url: string;
    alt: string;
    error: string | null;
  }>({ open: false, url: "", alt: "", error: null });

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[360px] px-4 py-3 focus:outline-none prose-headings:text-[#132960] prose-p:text-[#132960]/90 prose-a:text-[#027DFC]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = ed.getHTML();
      setHtml(next);
      setCounts({ words: countWords(ed.getText()), chars: ed.getText().length });
      onChange?.(next);
    },
  });

  // Mantém o estado de edição em sincronia com a prop `disabled`.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (editor && initialHtml && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml);
      setHtml(initialHtml);
    }
  }, [editor, initialHtml]);

  // Conta palavras/caracteres iniciais quando o editor monta.
  useEffect(() => {
    if (!editor) return;
    const text = editor.getText();
    setCounts({ words: countWords(text), chars: text.length });
  }, [editor]);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImageDialog((d) => ({ ...d, error: null }));
    try {
      const url = await uploadImage(file);
      setImageDialog((d) => ({ ...d, url }));
    } catch (err) {
      setImageDialog((d) => ({
        ...d,
        error: err instanceof Error ? err.message : "Falha no upload",
      }));
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function openLinkDialog() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkDialog({
      open: true,
      url: previousUrl || "",
      text: "",
      newTab: true,
      hasSelection,
    });
  }

  function applyLink() {
    if (!editor) return;
    const url = linkDialog.url.trim();
    if (!url) {
      // URL vazia remove o link existente.
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkDialog((d) => ({ ...d, open: false }));
      return;
    }
    const attrs = {
      href: url,
      target: linkDialog.newTab ? "_blank" : null,
      rel: linkDialog.newTab ? "noopener noreferrer" : null,
    };

    if (linkDialog.hasSelection) {
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    } else {
      const text = linkDialog.text.trim() || url;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text,
          marks: [{ type: "link", attrs }],
        })
        .run();
    }
    setLinkDialog((d) => ({ ...d, open: false }));
  }

  function applyImage() {
    if (!editor) return;
    const src = imageDialog.url.trim();
    const alt = imageDialog.alt.trim();
    if (!src || !alt) {
      setImageDialog((d) => ({ ...d, error: "Informe a URL e o texto alternativo." }));
      return;
    }
    editor.chain().focus().setImage({ src, alt }).run();
    setImageDialog({ open: false, url: "", alt: "", error: null });
  }

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-[#132960]/15 bg-white">
      <Toolbar
        editor={editor}
        disabled={disabled}
        uploading={uploading}
        onOpenLink={openLinkDialog}
        onOpenImage={() => setImageDialog({ open: true, url: "", alt: "", error: null })}
      />

      {uploadError ? (
        <p className="border-b border-[#132960]/10 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {uploadError}
        </p>
      ) : null}

      {/* Bubble menu: aparece ao selecionar texto, para aplicar link rápido. */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: ed, from, to }) =>
          !disabled && from !== to && ed.isEditable && !ed.isActive("image")
        }
        className="flex items-center gap-0.5 rounded-lg border border-[#132960]/15 bg-white p-1 shadow-lg"
      >
        <BubbleButton
          active={editor.isActive("bold")}
          label="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden className="h-4 w-4" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive("italic")}
          label="Itálico"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden className="h-4 w-4" />
        </BubbleButton>
        <BubbleButton
          active={editor.isActive("link")}
          label="Link"
          onClick={openLinkDialog}
        >
          <LinkIcon aria-hidden className="h-4 w-4" />
        </BubbleButton>
      </BubbleMenu>

      <EditorContent editor={editor} />

      <Counter words={counts.words} chars={counts.chars} />

      <input type="hidden" name={name} value={html} readOnly />

      {/* Dialog de Link */}
      <EditorDialog
        open={linkDialog.open}
        title={linkDialog.hasSelection ? "Aplicar link à seleção" : "Inserir link"}
        onClose={() => setLinkDialog((d) => ({ ...d, open: false }))}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
          className="space-y-3"
        >
          <label className="block text-sm">
            <span className="text-[#132960]/65">URL</span>
            <input
              type="url"
              required
              value={linkDialog.url}
              onChange={(e) => setLinkDialog((d) => ({ ...d, url: e.target.value }))}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
            />
          </label>
          {!linkDialog.hasSelection ? (
            <label className="block text-sm">
              <span className="text-[#132960]/65">Texto do link</span>
              <input
                type="text"
                value={linkDialog.text}
                onChange={(e) => setLinkDialog((d) => ({ ...d, text: e.target.value }))}
                placeholder="Texto exibido (usa a URL se vazio)"
                className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-[#132960]/75">
            <input
              type="checkbox"
              checked={linkDialog.newTab}
              onChange={(e) => setLinkDialog((d) => ({ ...d, newTab: e.target.checked }))}
              className="h-4 w-4 rounded border-[#132960]/30 text-[#027DFC] focus:ring-[#027DFC]"
            />
            Abrir em nova aba
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLinkDialog((d) => ({ ...d, open: false }))}
              className="rounded-md border border-[#132960]/20 px-4 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0268d4]"
            >
              {linkDialog.url.trim() ? "Aplicar link" : "Remover link"}
            </button>
          </div>
        </form>
      </EditorDialog>

      {/* Dialog de Imagem */}
      <EditorDialog
        open={imageDialog.open}
        title="Inserir imagem"
        onClose={() => setImageDialog({ open: false, url: "", alt: "", error: null })}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyImage();
          }}
          className="space-y-3"
        >
          <label className="block text-sm">
            <span className="text-[#132960]/65">URL da imagem</span>
            <input
              type="url"
              value={imageDialog.url}
              onChange={(e) => setImageDialog((d) => ({ ...d, url: e.target.value }))}
              placeholder="https://… ou envie um arquivo"
              className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
            />
          </label>
          <div>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-[#132960]/25 px-3 py-2 text-sm font-medium text-[#132960]/80 transition hover:bg-[#132960]/5 disabled:opacity-50"
            >
              {uploading ? "Enviando…" : "Enviar arquivo"}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageFile}
              className="hidden"
            />
          </div>
          {imageDialog.url ? (
            <div className="overflow-hidden rounded-md border border-[#132960]/15">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview de URL remota */}
              <img src={imageDialog.url} alt="Pré-visualização" className="max-h-40 w-full object-contain" />
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="text-[#132960]/65">
              Texto alternativo (ALT) <span className="text-[#9C2B24]">*</span>
            </span>
            <input
              type="text"
              required
              value={imageDialog.alt}
              onChange={(e) => setImageDialog((d) => ({ ...d, alt: e.target.value }))}
              placeholder="Descreva a imagem (acessibilidade)"
              className="mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
            />
          </label>
          {imageDialog.error ? (
            <p className="text-xs text-red-600">{imageDialog.error}</p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setImageDialog({ open: false, url: "", alt: "", error: null })}
              className="rounded-md border border-[#132960]/20 px-4 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0268d4]"
            >
              Inserir imagem
            </button>
          </div>
        </form>
      </EditorDialog>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Toolbar
 * ------------------------------------------------------------------------- */

type ToolbarEditor = NonNullable<ReturnType<typeof useEditor>>;

function Toolbar({
  editor,
  disabled,
  uploading,
  onOpenLink,
  onOpenImage,
}: {
  editor: ToolbarEditor;
  disabled: boolean;
  uploading: boolean;
  onOpenLink: () => void;
  onOpenImage: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatação do texto"
      aria-disabled={disabled}
      className="flex flex-wrap items-center gap-0.5 border-b border-[#132960]/10 bg-[#F3F5FB] px-2 py-1.5"
    >
      <ToolButton
        label="Negrito"
        active={editor.isActive("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Itálico"
        active={editor.isActive("italic")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Título (H2)"
        active={editor.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Subtítulo (H3)"
        active={editor.isActive("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 aria-hidden className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Lista com marcadores"
        active={editor.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Citação"
        active={editor.isActive("blockquote")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Divisor"
        active={false}
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus aria-hidden className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Link"
        active={editor.isActive("link")}
        disabled={disabled}
        onClick={onOpenLink}
      >
        <LinkIcon aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Imagem"
        active={false}
        disabled={disabled || uploading}
        onClick={onOpenImage}
      >
        <ImageIcon aria-hidden className="h-4 w-4" />
      </ToolButton>

      <Separator />

      <ToolButton
        label="Desfazer"
        active={false}
        disabled={disabled || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 aria-hidden className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Refazer"
        active={false}
        disabled={disabled || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 aria-hidden className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-[#132960]/15" />;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-[#027DFC] text-white shadow-sm"
          : "text-[#132960]/70 hover:bg-[#132960]/8 hover:text-[#132960]"
      }`}
    >
      {children}
    </button>
  );
}

function BubbleButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        active ? "bg-[#027DFC] text-white" : "text-[#132960]/70 hover:bg-[#132960]/8"
      }`}
    >
      {children}
    </button>
  );
}

function Counter({ words, chars }: { words: number; chars: number }) {
  const label = useMemo(() => readingTimeLabel(words), [words]);
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-[#132960]/10 bg-[#F3F5FB] px-3 py-1.5 text-xs text-[#132960]/55">
      <span>{words} {words === 1 ? "palavra" : "palavras"}</span>
      <span>{chars} {chars === 1 ? "caractere" : "caracteres"}</span>
      <span>{label}</span>
    </div>
  );
}
