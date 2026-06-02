import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { daysAgo } from "@/lib/analytics";
import { authorScopeWhere, canReviewPosts } from "@/lib/workspace/permissions";
import { POST_STATUS_LABELS } from "@/lib/workspace/posts";

export default async function DashboardPage() {
  const session = await requireSession();
  const since7 = daysAgo(7);
  const scope = authorScopeWhere(session);

  const [
    postsTotal,
    pendingReview,
    pageViews7d,
    whatsapp7d,
    fiiLeads7d,
    consorcioLeads7d,
    recentPosts,
  ] = await Promise.all([
    prisma.post.count({ where: scope }),
    canReviewPosts(session)
      ? prisma.post.count({ where: { status: "PENDING_REVIEW" } })
      : Promise.resolve(0),
    prisma.analyticsEvent.count({
      where: {
        type: "page_view",
        createdAt: { gte: since7 },
        ...(scope.authorId ? { authorId: scope.authorId } : {}),
      },
    }),
    prisma.authorWhatsappClick.count({
      where: {
        createdAt: { gte: since7 },
        ...(scope.authorId ? { authorId: scope.authorId } : {}),
      },
    }),
    session.role === "AUTHOR"
      ? Promise.resolve(0)
      : prisma.fiiLead.count({ where: { createdAt: { gte: since7 } } }),
    session.role === "AUTHOR"
      ? Promise.resolve(0)
      : prisma.consorcioLead.count({ where: { createdAt: { gte: since7 } } }),
    prisma.post.findMany({
      where: scope,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const cards = [
    { label: "Textos", value: postsTotal },
    { label: "Views (7d)", value: pageViews7d },
    { label: "Cliques WhatsApp (7d)", value: whatsapp7d },
    ...(session.role !== "AUTHOR"
      ? [
          { label: "Leads FII (7d)", value: fiiLeads7d },
          { label: "Leads Consórcio (7d)", value: consorcioLeads7d },
        ]
      : []),
    ...(canReviewPosts(session)
      ? [{ label: "Aguardando revisão", value: pendingReview }]
      : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Dashboard</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Olá{session.name ? `, ${session.name}` : ""}. Resumo do workspace.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-[#132960]/12 bg-white px-4 py-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-[#132960]/55">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#132960]">{c.value}</p>
          </div>
        ))}
      </div>

      {canReviewPosts(session) && pendingReview > 0 ? (
        <Link
          href="/area-restrita/revisao"
          className="mt-4 inline-block rounded-md bg-[#FF5713]/10 px-4 py-2 text-sm font-medium text-[#FF5713] hover:bg-[#FF5713]/15"
        >
          {pendingReview} texto(s) aguardando revisão →
        </Link>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#132960]">Textos recentes</h2>
          <Link href="/area-restrita/conteudo/novo" className="text-sm font-medium text-[#027DFC] hover:underline">
            Novo texto
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-[#132960]/10 rounded-lg border border-[#132960]/12 bg-white shadow-sm">
          {recentPosts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link
                  href={`/area-restrita/conteudo/${p.id}`}
                  className="font-medium text-[#132960] hover:text-[#027DFC]"
                >
                  {p.title}
                </Link>
                <p className="text-xs text-[#132960]/55">{POST_STATUS_LABELS[p.status]}</p>
              </div>
            </li>
          ))}
          {recentPosts.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[#132960]/55">Nenhum texto ainda.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
