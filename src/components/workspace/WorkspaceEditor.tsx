"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/components/workspace/image-upload";

type Props = {
  name: string;
  initialHtml?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
};

export function WorkspaceEditor({
  name,
  initialHtml = "",
  placeholder = "Comece a escrever…",
  onChange,
}: Props) {
  const [html, setHtml] = useState(initialHtml || "<p></p>");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[320px] px-4 py-3 focus:outline-none prose-headings:text-[#132960] prose-p:text-[#132960]/90 prose-a:text-[#027DFC]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = ed.getHTML();
      setHtml(next);
      onChange?.(next);
    },
  });

  useEffect(() => {
    if (editor && initialHtml && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml);
    }
  }, [editor, initialHtml]);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  if (!editor) return null;

  const btn =
    "rounded px-2 py-1 text-xs font-medium text-[#132960]/70 hover:bg-[#132960]/8 hover:text-[#132960] disabled:opacity-40";

  return (
    <div className="overflow-hidden rounded-lg border border-[#132960]/15 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-[#132960]/10 bg-[#F3F5FB] px-2 py-2">
        <button type="button" className={btn} onClick={() => editor.chain().focus().toggleBold().run()}>
          Negrito
        </button>
        <button type="button" className={btn} onClick={() => editor.chain().focus().toggleItalic().run()}>
          Itálico
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          Título
        </button>
        <button type="button" className={btn} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Lista
        </button>
        <button type="button" className={btn} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Citação
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            const url = window.prompt("URL do link");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Link
        </button>
        <button
          type="button"
          className={btn}
          disabled={uploading}
          onClick={() => imageInputRef.current?.click()}
        >
          {uploading ? "Enviando…" : "Imagem"}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageFile}
          className="hidden"
        />
      </div>
      {uploadError ? (
        <p className="border-b border-[#132960]/10 bg-red-50 px-3 py-1.5 text-xs text-red-600">{uploadError}</p>
      ) : null}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}
