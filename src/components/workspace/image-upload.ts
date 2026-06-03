// Utilidades client-side de upload de imagem do workspace.
// Redimensiona/comprime no navegador antes do upload: evita o limite de corpo
// da funcao serverless da Vercel (~4.5 MB) e mantem o site leve. GIF passa direto.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export async function processImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(file);
    }
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "imagem";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export async function uploadImage(file: File): Promise<string> {
  const toUpload = await processImage(file);
  const body = new FormData();
  body.append("file", toUpload);
  const res = await fetch("/api/area-restrita/blog-upload", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Falha no upload");
  return String(data.url);
}
