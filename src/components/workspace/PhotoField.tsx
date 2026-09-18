"use client";

import { useEffect, useRef, useState } from "react";
import {
  imageSizeWarning,
  uploadImageWithMeta,
  type ImageSize,
  type UploadImageOptions,
} from "@/components/workspace/image-upload";

type Variant = "avatar" | "cover";

type Props = {
  name?: string;
  defaultValue?: string | null;
  variant?: Variant;
};

// Capa do post e exibida a ~800 px CSS (1600 px em retina): abaixo de 1000 px barra,
// abaixo de 1600 px avisa. Avatar nao tem gate, so aviso abaixo de 400 px.
const SIZE_RULES: Record<Variant, UploadImageOptions> = {
  cover: { minWidth: 1000, warnWidth: 1600, landscapeOnly: true, label: "Capa" },
  avatar: { warnWidth: 400, label: "Foto" },
};

export function PhotoField({ name = "photo", defaultValue = "", variant = "avatar" }: Props) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [size, setSize] = useState<ImageSize | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isCover = variant === "cover";
  const thing = isCover ? "capa" : "foto";
  const rules = SIZE_RULES[variant];
  // Derivado do tamanho (do upload ou do <img> da previa), assim capa antiga tambem avisa.
  const warning = size ? imageSizeWarning(size.width, rules) : undefined;

  // Le as dimensoes reais pela previa; guarda a referencia se nada mudou (sem re-render a toa).
  function measure(img: HTMLImageElement) {
    if (img.naturalWidth <= 0) return;
    const { naturalWidth: width, naturalHeight: height } = img;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }

  // Capa antiga vinda do servidor pode carregar do cache antes da hidratacao, sem disparar onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) measure(img);
  }, [url]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadImageWithMeta(file, rules);
      setUrl(uploaded.url);
      setSize(uploaded.width != null && uploaded.height != null ? { width: uploaded.width, height: uploaded.height } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    setUrl("");
    setSize(null);
    setError(null);
  }

  return (
    <div className="mt-1 space-y-2">
      <input type="hidden" name={name} value={url} readOnly />
      <div className="flex items-center gap-3">
        <div
          className={`relative shrink-0 overflow-hidden border border-[#132960]/15 bg-[#132960]/5 ${
            isCover ? "h-20 w-36 rounded-lg" : "h-16 w-16 rounded-full"
          }`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={url}
              alt="Pré-visualização"
              className="h-full w-full object-cover"
              onLoad={(e) => measure(e.currentTarget)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-[#132960]/45">
              sem {thing}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-md border border-[#132960]/25 px-3 py-2 text-sm font-medium text-[#132960]/80 hover:bg-[#132960]/5 disabled:opacity-50"
          >
            {busy ? "Enviando…" : url ? `Trocar ${thing}` : `Anexar ${thing}`}
          </button>
          {url && size ? (
            <span className="text-xs text-[#132960]/60">
              {size.width}×{size.height}
              {warning ? "" : " ✓"}
            </span>
          ) : null}
          {url ? (
            <button type="button" onClick={remove} className="text-xs text-red-600 hover:underline">
              Remover
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={isCover ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,image/gif"}
          onChange={handleFile}
          className="hidden"
        />
      </div>
      <p className="text-xs text-[#132960]/45">
        {isCover
          ? "JPG, PNG ou WebP, paisagem, mínimo 1000 px de largura (ideal 1600+). A imagem é otimizada automaticamente."
          : "JPG, PNG, WebP ou GIF — a imagem é otimizada automaticamente."}
      </p>
      {url && warning ? <p className="text-xs text-amber-700">{warning}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
