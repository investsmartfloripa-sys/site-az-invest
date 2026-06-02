"use client";

import { useRef, useState } from "react";

type Props = { name?: string; defaultValue?: string | null };

export function PhotoField({ name = "photo", defaultValue = "" }: Props) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/area-restrita/blog-upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha no upload");
      setUrl(String(data.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <input type="hidden" name={name} value={url} readOnly />
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#132960]/15 bg-[#132960]/5">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Pré-visualização" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-[#132960]/45">
              sem foto
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
            {busy ? "Enviando…" : url ? "Trocar foto" : "Anexar foto"}
          </button>
          {url ? (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="text-xs text-red-600 hover:underline"
            >
              Remover
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      <p className="text-xs text-[#132960]/45">JPG, PNG, WebP ou GIF, até 5 MB.</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
