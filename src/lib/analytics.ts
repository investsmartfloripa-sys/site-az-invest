import { prisma } from "@/lib/prisma";

export type AnalyticsEventInput = {
  type: string;
  path?: string;
  referrer?: string;
  authorId?: number;
  postId?: number;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(input: AnalyticsEventInput) {
  await prisma.analyticsEvent.create({
    data: {
      type: input.type,
      path: input.path ?? null,
      referrer: input.referrer ?? null,
      authorId: input.authorId ?? null,
      postId: input.postId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function countEventsSince(since: Date, where: { authorId?: number } = {}) {
  return prisma.analyticsEvent.count({
    where: {
      createdAt: { gte: since },
      ...(where.authorId ? { authorId: where.authorId } : {}),
    },
  });
}

export async function pageViewStats(since: Date, authorId?: number) {
  const events = await prisma.analyticsEvent.groupBy({
    by: ["path"],
    where: {
      type: "page_view",
      createdAt: { gte: since },
      ...(authorId ? { authorId } : {}),
    },
    _count: { path: true },
    orderBy: { _count: { path: "desc" } },
    take: 15,
  });

  return events.map((e) => ({
    path: e.path || "/",
    count: e._count.path,
  }));
}
