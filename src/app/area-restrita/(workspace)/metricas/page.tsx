import { requireSession } from "@/lib/auth";
import { daysAgo, pageViewStats } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { authorScopeWhere } from "@/lib/workspace/permissions";

export default async function MetricasPage() {
  const session = await requireSession();
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);
  const scope = authorScopeWhere(session);
  const authorId = scope.authorId;

  const [views7, views30, topPages, postViews] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        type: "page_view",
        createdAt: { gte: since7 },
        ...(authorId ? { authorId } : {}),
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        type: "page_view",
        createdAt: { gte: since30 },
        ...(authorId ? { authorId } : {}),
      },
    }),
    pageViewStats(since30, authorId),
    authorId
      ? prisma.analyticsEvent.groupBy({
          by: ["postId"],
          where: {
            type: "page_view",
            postId: { not: null },
            authorId,
            createdAt: { gte: since30 },
          },
          _count: { postId: true },
          orderBy: { _count: { postId: "desc" } },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  const postIds = postViews.map((p) => p.postId).filter((id): id is number => id != null);
  const posts =
    postIds.length > 0
      ? await prisma.post.findMany({ where: { id: { in: postIds } } })
      : [];
  const postMap = new Map(posts.map((p) => [p.id, p.title]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Métricas</h1>
      <p className="mt-1 text-sm text-[#132960]/60">Visualizações coletadas no site (first-party).</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#132960]/12 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[#132960]/55">Pageviews 7 dias</p>
          <p className="mt-1 text-3xl font-semibold text-[#132960]">{views7}</p>
        </div>
        <div className="rounded-lg border border-[#132960]/12 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-[#132960]/55">Pageviews 30 dias</p>
          <p className="mt-1 text-3xl font-semibold text-[#132960]">{views30}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[#132960]">Top páginas (30d)</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {topPages.map((p) => (
            <li
              key={p.path}
              className="flex justify-between rounded border border-[#132960]/12 bg-white px-3 py-2 text-[#132960]/80"
            >
              <span>{p.path}</span>
              <span className="text-[#132960]/55">{p.count}</span>
            </li>
          ))}
          {topPages.length === 0 ? (
            <li className="text-[#132960]/55">Sem dados ainda — o beacon começa a coletar após deploy.</li>
          ) : null}
        </ul>
      </section>

      {authorId && postViews.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[#132960]">Views por texto (30d)</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {postViews.map((pv) => (
              <li
                key={pv.postId}
                className="flex justify-between rounded border border-[#132960]/12 bg-white px-3 py-2 text-[#132960]/80"
              >
                <span>{postMap.get(pv.postId!) || `Post #${pv.postId}`}</span>
                <span className="text-[#132960]/55">{pv._count.postId}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
