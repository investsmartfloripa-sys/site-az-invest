import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// Allowlist de tipos de evento aceitos pelo endpoint público.
// Hoje o site só dispara "page_view" (AnalyticsBeacon). Ao criar um novo
// evento no front (ex.: whatsapp_click), adicione o type aqui.
const ALLOWED_TYPES = new Set(["page_view"]);

const MAX_PATH_LENGTH = 500;
const MAX_REFERRER_LENGTH = 500;
const MAX_UTM_LENGTH = 200;

function asTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  return value.slice(0, maxLength);
}

export async function POST(request: Request) {
  // Rate limit best-effort por IP (janela deslizante em memória — vale por
  // instância serverless e zera em cold start; ver src/lib/rate-limit.ts).
  const ip = getClientIp(request.headers);
  if (!rateLimit(`analytics:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      type?: unknown;
      path?: unknown;
      referrer?: unknown;
      authorId?: unknown;
      postId?: unknown;
      utm_source?: unknown;
      utm_medium?: unknown;
      utm_campaign?: unknown;
    };

    const type = body.type ?? "page_view";
    if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const path = body.path;
    if (typeof path !== "string" || !path.startsWith("/") || path.length > MAX_PATH_LENGTH) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    let postId = Number.isInteger(body.postId) ? (body.postId as number) : undefined;
    let authorId = Number.isInteger(body.authorId) ? (body.authorId as number) : undefined;

    if (path.startsWith("/blog/") && !postId) {
      const slug = path.replace(/^\/blog\//, "").split("/")[0];
      const post = await prisma.post.findUnique({
        where: { slug },
        select: { id: true, authorId: true },
      });
      if (post) {
        postId = post.id;
        authorId = post.authorId ?? undefined;
      }
    }

    if (path.startsWith("/nosso-time/") && !authorId) {
      const slug = path.replace(/^\/nosso-time\//, "").split("/")[0];
      const author = await prisma.author.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (author) authorId = author.id;
    }

    await trackEvent({
      type,
      path,
      referrer: asTrimmedString(body.referrer, MAX_REFERRER_LENGTH),
      authorId,
      postId,
      metadata: {
        utm_source: asTrimmedString(body.utm_source, MAX_UTM_LENGTH),
        utm_medium: asTrimmedString(body.utm_medium, MAX_UTM_LENGTH),
        utm_campaign: asTrimmedString(body.utm_campaign, MAX_UTM_LENGTH),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
