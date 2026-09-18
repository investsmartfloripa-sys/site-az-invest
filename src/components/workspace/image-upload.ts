// Utilidades client-side de upload de imagem do workspace.
// Redimensiona/comprime no navegador antes do upload: evita o limite de corpo
// da funcao serverless da Vercel (~4.5 MB) e mantem o site leve. GIF passa direto.
// Tambem mede a imagem antes de enviar: capa pequena demais e barrada aqui,
// capa abaixo do ideal sobe com aviso (a exibicao a ~800 px CSS = 1600 px retina).

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export type ImageSize = { width: number; height: number };

// Arquivo pronto para subir + dimensoes finais (null quando o navegador nao decodifica).
export type ProcessedImage = { file: File; width: number | null; height: number | null };

export type UploadImageOptions = {
  // Largura minima em px: abaixo disso o upload e recusado (erro).
  minWidth?: number;
  // Largura ideal em px: abaixo disso sobe, mas devolve `warning`.
  warnWidth?: number;
  // Recusa imagem mais alta que larga.
  landscapeOnly?: boolean;
  // Como chamar a imagem nas mensagens ("Capa", "Foto"...). Feminino, como "Imagem".
  label?: string;
};

export type UploadedImage = {
  url: string;
  width: number | null;
  height: number | null;
  warning?: string;
};

// Decodifica respeitando a orientacao EXIF; sem suporte a opcao, tenta sem ela.
async function decodeBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return await createImageBitmap(file);
    }
  } catch {
    return null;
  }
}

// Le largura/altura de um arquivo de imagem sem redimensionar nada.
export async function readImageSize(file: File): Promise<ImageSize | null> {
  const bitmap = await decodeBitmap(file);
  if (!bitmap) return null;
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return size;
}

async function passthrough(file: File): Promise<ProcessedImage> {
  const size = await readImageSize(file);
  return { file, width: size?.width ?? null, height: size?.height ?? null };
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.type === "image/gif") return passthrough(file);
  const bitmap = await decodeBitmap(file);
  if (!bitmap) return { file, width: null, height: null };
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const original = { file, width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return original;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const original = { file, width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return original;
  const base = file.name.replace(/\.[^.]+$/, "") || "imagem";
  return { file: new File([blob], `${base}.jpg`, { type: "image/jpeg" }), width: w, height: h };
}

function formatSize(width: number, height: number) {
  return `${width}×${height}`;
}

// Aviso (nao bloqueante) para imagem abaixo do ideal. Reaproveitado pelo PhotoField
// para avisar tambem sobre capa antiga ja gravada, medida pelo <img> da previa.
export function imageSizeWarning(width: number, opts: UploadImageOptions): string | undefined {
  const label = opts.label ?? "Imagem";
  if (opts.minWidth != null && width < opts.minWidth) {
    return `${label} com ${width} px de largura — abaixo do mínimo de ${opts.minWidth} px; troque por uma imagem maior.`;
  }
  if (opts.warnWidth != null && width < opts.warnWidth) {
    return `${label} com ${width} px de largura — abaixo de ${opts.warnWidth} px pode ficar borrada em telas grandes.`;
  }
  return undefined;
}

// Mede, valida e sobe. Lanca Error (mensagem em pt-BR, pronta para a tela) quando a
// imagem nao cumpre minWidth/landscapeOnly; devolve url + dimensoes finais + aviso.
export async function uploadImageWithMeta(
  file: File,
  opts: UploadImageOptions = {},
): Promise<UploadedImage> {
  const { minWidth, landscapeOnly = false } = opts;
  const label = opts.label ?? "Imagem";
  const { file: toUpload, width, height } = await processImage(file);
  const gated = minWidth != null || landscapeOnly;
  if (width == null || height == null) {
    if (gated) {
      throw new Error("Não foi possível ler as dimensões da imagem. Envie um arquivo JPG, PNG ou WebP.");
    }
  } else {
    if (minWidth != null && width < minWidth) {
      throw new Error(
        `${label} muito pequena: ${formatSize(width, height)}. Envie uma imagem com pelo menos ${minWidth} px de largura${
          landscapeOnly ? ", em formato paisagem" : ""
        }.`,
      );
    }
    if (landscapeOnly && height > width) {
      throw new Error(
        `${label} em formato retrato: ${formatSize(width, height)}. Envie uma imagem em formato paisagem (mais larga que alta).`,
      );
    }
  }
  const body = new FormData();
  body.append("file", toUpload);
  const res = await fetch("/api/area-restrita/blog-upload", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Falha no upload");
  const warning = width != null ? imageSizeWarning(width, opts) : undefined;
  return { url: String(data.url), width, height, warning };
}

// Assinatura antiga (imagens inline do editor): sem gate, devolve so a URL.
export async function uploadImage(file: File): Promise<string> {
  return (await uploadImageWithMeta(file)).url;
}
