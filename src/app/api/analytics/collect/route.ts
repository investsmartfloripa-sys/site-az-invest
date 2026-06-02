import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: string;
      path?: string;
      referrer?: string;
      authorId?: number;
      postId?: number;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };

    const type = body.type || "page_view";
    const path = body.path?.slice(0, 500);

    let postId = body.postId;
    let authorId = body.authorId;

    if (path?.startsWith("/blog/") && !postId) {
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

    if (path?.startsWith("/nosso-time/") && !authorId) {
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
      referrer: body.referrer?.slice(0, 500),
      authorId,
      postId,
      metadata: {
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
