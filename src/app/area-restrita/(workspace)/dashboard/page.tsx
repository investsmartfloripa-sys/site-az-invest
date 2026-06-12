import Link from "next/link";
import { Prisma } from "@prisma/client";
import { isStaffOrAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { daysAgo } from "@/lib/analytics";
import {
  authorScopeWhere,
  canReviewPosts,
  canViewDataHealth,
} from "@/lib/workspace/permissions";
import { POST_STATUS_LABELS } from "@/lib/workspace/posts";
import { ChartCard, KpiCard } from "@/components/painel/core";
import { fmtNum } from "@/lib/format-br";
import { MetricDailyViewsChart } from "@/components/workspace/MetricDailyViewsChart";

type DateRange = { gte: Date; lt?: Date };

/** Variação % cur vs prev — null sem base de comparação (badge omitido). */
function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

function plural(n: number, singular: string, multiple: string): string {
  return n === 1 ? singular : multiple;
}

/**
 * Leads totais na janela: FII + Consórcio + AuthorLead para staff/admin;
 * apenas AuthorLead do próprio autor para AUTHOR.
 */
async function countLeads(range: DateRange, staff: boolean, authorId?: number): Promise<number> {
  if (!staff) {
    if (!authorId) return 0;
    return prisma.authorLead.count({ where: { authorId, createdAt: range } });
  }
  const [fii, consorcio, author] = await Promise.all([
    prisma.fiiLead.count({ where: { createdAt: range } }),
    prisma.consorcioLead.count({ where: { createdAt: range } }),
    prisma.authorLead.count({ where: { createdAt: range } }),
  ]);
  return fii + consorcio + author;
}

/**
 * Pageviews agregados POR DIA no banco (date_trunc no fuso de São Paulo —
 * createdAt é timestamp UTC, daí o duplo AT TIME ZONE). COUNT vem ::int para
 * não chegar como BigInt; dias sem evento são preenchidos com zero.
 */
async function dailyPageViews(since: Date, authorId?: number): Promise<[string, number][]> {
  const authorFilter =
    authorId != null ? Prisma.sql`AND "authorId" = ${authorId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ day: string; views: number }>>`
    SELECT to_char(
             date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'),
             'YYYY-MM-DD'
           ) AS day,
           COUNT(*)::int AS views
    FROM "AnalyticsEvent"
    WHERE type = 'page_view'
      AND "createdAt" >= ${since}
      ${authorFilter}
    GROUP BY 1
    ORDER BY 1
  `;

  const byDay = new Map(rows.map((r) => [r.day, Number(r.views)]));
  const spDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const points: [string, number][] = [];
  let t = Date.parse(`${spDay.format(since)}T00:00:00Z`);
  const endT = Date.parse(`${spDay.format(new Date())}T00:00:00Z`);
  while (t <= endT) {
    const iso = new Date(t).toISOString().slice(0, 10);
    points.push([iso, byDay.get(iso) ?? 0]);
    t += 86_400_000;
  }
  return points;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const scope = authorScopeWhere(session);
  const authorId = scope.authorId;
  const staff = isStaffOrAdmin(session.role);
  const canReview = canReviewPosts(session);
  const canData = canViewDataHealth(session);

  const since7 = daysAgo(7);
  const since14 = daysAgo(14);
  const since30 = daysAgo(30);
  const since60 = daysAgo(60);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const viewsWhere = (range: DateRange) => ({
    type: "page_view",
    createdAt: range,
    ...(authorId ? { authorId } : {}),
  });
  const waWhere = (range: DateRange) => ({
    createdAt: range,
    ...(authorId ? { authorId } : {}),
  });

  const [
    views7,
    views7Prev,
    wa7,
    wa7Prev,
    leads7,
    leads7Prev,
    leads24h,
    published30,
    published30Prev,
    pendingReview,
    dataIssues,
    recentPosts,
    dailyViews,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: viewsWhere({ gte: since7 }) }),
    prisma.analyticsEvent.count({ where: viewsWhere({ gte: since14, lt: since7 }) }),
    prisma.authorWhatsappClick.count({ where: waWhere({ gte: since7 }) }),
    prisma.authorWhatsappClick.count({ where: waWhere({ gte: since14, lt: since7 }) }),
    countLeads({ gte: since7 }, staff, authorId),
    countLeads({ gte: since14, lt: since7 }, staff, authorId),
    staff ? countLeads({ gte: last24h }, true) : Promise.resolve(0),
    prisma.post.count({ where: { ...scope, publishedAt: { gte: since30 } } }),
    prisma.post.count({ where: { ...scope, publishedAt: { gte: since60, lt: since30 } } }),
    canReview
      ? prisma.post.count({ where: { status: "PENDING_REVIEW" } })
      : Promise.resolve(0),
    canData
      ? prisma.dataSourceSnapshot.count({
          where: {
            OR: [
              { error: { not: null } },
              { workflowStatus: { in: ["failure", "cancelled", "timed_out"] } },
              { freshness: { in: ["stale", "sem-metadado"] } },
            ],
          },
        })
      : Promise.resolve(0),
    prisma.post.findMany({
      where: scope,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true },
    }),
    dailyPageViews(since30, authorId),
  ]);

  const actions: { key: string; text: string; href: string; cta: string }[] = [];
  if (canReview && pendingReview > 0) {
    actions.push({
      key: "revisao",
      text: `${pendingReview} ${plural(pendingReview, "texto aguardando", "textos aguardando")} revisão`,
      href: "/area-restrita/revisao",
      cta: "Revisar",
    });
  }
  if (canData && dataIssues > 0) {
    actions.push({
      key: "dados",
      text: `${dataIssues} ${plural(dataIssues, "fonte de dados", "fontes de dados")} com erro ou aviso`,
      href: "/area-restrita/dados",
      cta: "Ver fontes",
    });
  }
  if (staff && leads24h > 0) {
    actions.push({
      key: "leads",
      text: `${leads24h} ${plural(leads24h, "lead recebido", "leads recebidos")} nas últimas 24h`,
      href: "/area-restrita/leads",
      cta: "Ver leads",
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Dashboard</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Olá{session.name ? `, ${session.name}` : ""}. Resumo do workspace.
      </p>

      {/* Requer ação — pendências acionáveis no topo do cockpit. */}
      <section
        className={`mt-6 rounded-2xl border bg-white p-4 shadow-sm ${
          actions.length > 0 ? "border-[#FF5713]/30" : "border-[#132960]/10"
        }`}
      >
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#132960]">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              actions.length > 0 ? "bg-[#FF5713]" : "bg-emerald-500"
            }`}
          />
          Requer ação
        </h2>
        {actions.length > 0 ? (
          <ul className="mt-3 divide-y divide-[#132960]/[0.06]">
            {actions.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-[#132960]/85">{a.text}</span>
                <Link
                  href={a.href}
                  className="shrink-0 rounded-md bg-[#027DFC]/10 px-3 py-1.5 text-xs font-semibold text-[#027DFC] hover:bg-[#027DFC]/15"
                >
                  {a.cta} →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-medium text-emerald-700">Nada pendente ✓</p>
        )}
      </section>

      {/* KPIs com delta vs janela anterior. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Views (7d)"
          value={fmtNum(views7, 0)}
          delta={pctDelta(views7, views7Prev)}
          deltaUnit="%"
          deltaHint="vs 7d anteriores"
        />
        <KpiCard
          label="Cliques WhatsApp (7d)"
          value={fmtNum(wa7, 0)}
          delta={pctDelta(wa7, wa7Prev)}
          deltaUnit="%"
          deltaHint="vs 7d anteriores"
        />
        <KpiCard
          label={staff ? "Leads (7d)" : "Leads do autor (7d)"}
          value={fmtNum(leads7, 0)}
          delta={pctDelta(leads7, leads7Prev)}
          deltaUnit="%"
          deltaHint="vs 7d anteriores"
          hint={staff ? "FII + consórcio + autores" : undefined}
        />
        <KpiCard
          label="Publicados (30d)"
          value={fmtNum(published30, 0)}
          delta={published30 - published30Prev}
          deltaUnit="abs"
          deltaHint="vs 30d anteriores"
        />
      </div>

      {/* Pageviews diários — leitura rápida da tração do site. */}
      <ChartCard
        title="Pageviews diários"
        subtitle={`Últimos 30 dias · coleta first-party${authorId ? " · somente páginas atribuídas a você" : ""}`}
        footer="Dias sem registro aparecem como zero · agregação no fuso America/Sao_Paulo."
        className="mt-4"
      >
        <MetricDailyViewsChart data={dailyViews} height={280} />
      </ChartCard>

      {/* Textos recentes — compacto. */}
      <section className="mt-4 rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#132960]">
            Textos recentes
          </h2>
          <Link
            href="/area-restrita/conteudo/novo"
            className="text-sm font-medium text-[#027DFC] hover:underline"
          >
            Novo texto
          </Link>
        </div>
        <ul className="mt-2 divide-y divide-[#132960]/[0.06]">
          {recentPosts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <Link
                href={`/area-restrita/conteudo/${p.id}`}
                className="min-w-0 truncate text-sm font-medium text-[#132960] hover:text-[#027DFC]"
              >
                {p.title}
              </Link>
              <span className="shrink-0 text-xs text-[#132960]/55">
                {POST_STATUS_LABELS[p.status]}
              </span>
            </li>
          ))}
          {recentPosts.length === 0 ? (
            <li className="py-4 text-sm text-[#132960]/55">Nenhum texto ainda.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
