import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extForType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "bin";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Upload nao configurado (BLOB_READ_WRITE_TOKEN)" },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (max 5 MB)" }, { status: 400 });
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Tipo nao permitido (use JPG, PNG, WebP ou GIF)" }, { status: 400 });
  }

  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const path = `blog/uploads/${stamp}-${random}.${extForType(type)}`;

  try {
    const blob = await put(path, file, {
      access: "public",
      token,
      contentType: type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[blog-upload]", e);
    return NextResponse.json({ error: "Falha ao enviar para o armazenamento" }, { status: 500 });
  }
}
