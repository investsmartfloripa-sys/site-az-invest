import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { daysAgo, pageViewStats } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { authorScopeWhere } from "@/lib/workspace/permissions";
import { ChartCard, KpiCard, RankingTable } from "@/components/painel/core";
import { fmtNum, fmtPct } from "@/lib/format-br";
import { MetricDailyViewsChart } from "@/components/workspace/MetricDailyViewsChart";

type DateRange = { gte: Date; lt?: Date };

/** Variação % cur vs prev — null sem base de comparação (badge omitido). */
function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Path encurtado p/ rótulo do ranking: home nomeada + elipse no meio de paths longos. */
function shortPath(path: string): string {
  const p = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (p === "" || p === "/") return "Início (/)";
  if (p.length <= 44) return p;
  return `${p.slice(0, 28)}…${p.slice(-13)}`;
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

/**
 * Top origens (utm_source) agregadas NO BANCO a partir do metadata JSON.
 * metadata é texto JSON (trackEvent grava via JSON.stringify); o CASE garante
 * que só strings JSON-objeto sejam castadas. Sem utm_source = tráfego
 * "direto/orgânico".
 */
async function topUtmSources(
  since: Date,
  authorId?: number,
): Promise<Array<{ source: string; views: number }>> {
  const authorFilter =
    authorId != null ? Prisma.sql`AND "authorId" = ${authorId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ source: string; views: number }>>`
    SELECT COALESCE(
             CASE WHEN metadata LIKE '{%' THEN NULLIF(metadata::jsonb ->> 'utm_source', '') END,
             'direto/orgânico'
           ) AS source,
           COUNT(*)::int AS views
    FROM "AnalyticsEvent"
    WHERE type = 'page_view'
      AND "createdAt" >= ${since}
      ${authorFilter}
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  `;
  return rows.map((r) => ({ source: r.source, views: Number(r.views) }));
}

export default async function MetricasPage() {
  const session = await requireSession();
  const scope = authorScopeWhere(session);
  const authorId = scope.authorId;

  const since7 = daysAgo(7);
  const since14 = daysAgo(14);
  const since30 = daysAgo(30);
  const since60 = daysAgo(60);

  const viewsWhere = (range: DateRange) => ({
    type: "page_view",
    createdAt: range,
    ...(authorId ? { authorId } : {}),
  });

  const [views7, views7Prev, views30, views30Prev, topPages, postViews, sources, dailyViews] =
    await Promise.all([
      prisma.analyticsEvent.count({ where: viewsWhere({ gte: since7 }) }),
      prisma.analyticsEvent.count({ where: viewsWhere({ gte: since14, lt: since7 }) }),
      prisma.analyticsEvent.count({ where: viewsWhere({ gte: since30 }) }),
      prisma.analyticsEvent.count({ where: viewsWhere({ gte: since60, lt: since30 }) }),
      pageViewStats(since30, authorId),
      prisma.analyticsEvent.groupBy({
        by: ["postId"],
        where: {
          type: "page_view",
          postId: { not: null },
          createdAt: { gte: since30 },
          ...(authorId ? { authorId } : {}),
        },
        _count: { postId: true },
        orderBy: { _count: { postId: "desc" } },
        take: 10,
      }),
      topUtmSources(since30, authorId),
      dailyPageViews(since30, authorId),
    ]);

  const postIds = postViews.map((p) => p.postId).filter((id): id is number => id != null);
  const posts =
    postIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, title: true },
        })
      : [];
  const postMap = new Map(posts.map((p) => [p.id, p.title]));

  const share = (n: number) => (views30 > 0 ? (n / views30) * 100 : 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Métricas</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Visualizações coletadas no site (first-party)
        {authorId ? " · somente páginas atribuídas a você" : ""}.
      </p>

      {/* KPIs com comparação vs janela anterior. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Pageviews (7d)"
          value={fmtNum(views7, 0)}
          delta={pctDelta(views7, views7Prev)}
          deltaUnit="%"
          deltaHint="vs 7d anteriores"
        />
        <KpiCard
          label="Pageviews (30d)"
          value={fmtNum(views30, 0)}
          delta={pctDelta(views30, views30Prev)}
          deltaUnit="%"
          deltaHint="vs 30d anteriores"
        />
        <KpiCard
          label="Média diária (30d)"
          value={fmtNum(views30 / 30, 1)}
          hint="pageviews por dia"
        />
      </div>

      {/* Série diária de views — mesma query/wrapper do dashboard. */}
      <ChartCard
        title="Pageviews diários"
        subtitle="Últimos 30 dias · coleta first-party"
        footer="Dias sem registro aparecem como zero · agregação no fuso America/Sao_Paulo."
        className="mt-4"
      >
        <MetricDailyViewsChart data={dailyViews} height={280} />
      </ChartCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Top páginas com mini-barras proporcionais (padrão RankingTable da casa). */}
        <RankingTable
          title="Top páginas (30d)"
          dotColor="#027DFC"
          rows={topPages.map((p) => ({ label: shortPath(p.path), value: p.count }))}
          valueFmt={(v) => fmtNum(v, 0)}
        />

        {/* Origens de tráfego — utm_source agregado do metadata. */}
        <section className="rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#132960]">
            Origens de tráfego (30d)
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            utm_source das visitas · sem UTM = direto/orgânico.
          </p>
          {sources.length === 0 ? (
            <p className="mt-4 text-sm text-[#132960]/55">Sem dados ainda.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[#132960]/40">
                  <th className="py-1.5 font-medium">Origem</th>
                  <th className="py-1.5 text-right font-medium">Views</th>
                  <th className="py-1.5 text-right font-medium">% do total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#132960]/[0.06]">
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td className="max-w-0 truncate py-1.5 pr-2 text-[#132960]">{s.source}</td>
                    <td className="py-1.5 text-right tabular-nums text-[#132960]/80">
                      {fmtNum(s.views, 0)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#132960]/55">
                      {fmtPct(share(s.views), 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Views por texto — para autores (escopo próprio) e admin/staff (todos). */}
      <section className="mt-4 rounded-2xl border border-[#132960]/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#132960]">
          Views por texto (30d)
        </h2>
        {postViews.length === 0 ? (
          <p className="mt-4 text-sm text-[#132960]/55">
            Sem views atribuídas a textos no período.
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[#132960]/40">
                <th className="py-1.5 font-medium">Texto</th>
                <th className="py-1.5 text-right font-medium">Views</th>
                <th className="py-1.5 text-right font-medium">% do total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132960]/[0.06]">
              {postViews.map((pv) => {
                const count = pv._count.postId;
                return (
                  <tr key={pv.postId}>
                    <td className="max-w-0 truncate py-1.5 pr-2 text-[#132960]">
                      {pv.postId != null
                        ? (postMap.get(pv.postId) ?? `Post #${pv.postId}`)
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#132960]/80">
                      {fmtNum(count, 0)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#132960]/55">
                      {fmtPct(share(count), 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
