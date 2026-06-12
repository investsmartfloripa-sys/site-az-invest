import Link from "next/link";
import type { Prisma, PostStatus } from "@prisma/client";
import { ExternalLink, Eye, Pencil, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import { daysAgo } from "@/lib/analytics";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePostAction } from "@/lib/workspace/post-actions";
import { authorScopeWhere, canManageAllAuthors } from "@/lib/workspace/permissions";
import { POST_STATUS_LABELS, statusBadgeClass } from "@/lib/workspace/posts";

const PER_PAGE = 20;

const POST_STATUSES: PostStatus[] = ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"];

/** Rótulos curtos dos chips de filtro (leitura rápida, sem repetir o badge). */
const CHIP_LABELS: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em revisão",
  APPROVED: "Publicado",
  REJECTED: "Devolvido",
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  autor?: string;
  page?: string;
}>;

function parseStatus(raw: string | undefined): PostStatus | null {
  return POST_STATUSES.find((s) => s === raw) ?? null;
}

/** Monta o href preservando filtros (q/status/autor) e trocando só o que mudar. */
function buildHref(params: {
  q: string;
  status: PostStatus | null;
  autorId: number | null;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.autorId) search.set("autor", String(params.autorId));
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/area-restrita/conteudo?${query}` : "/area-restrita/conteudo";
}

export default async function ConteudoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isStaff = canManageAllAuthors(session);

  const q = (params.q ?? "").trim();
  const status = parseStatus(params.status);
  const autorId = isStaff && Number.isInteger(Number(params.autor)) && Number(params.autor) > 0
    ? Number(params.autor)
    : null;
  const requestedPage = Math.max(1, Number(params.page) || 1);

  // Base sem o filtro de status — usada também para os contadores dos chips.
  const baseWhere: Prisma.PostWhereInput = {
    ...authorScopeWhere(session),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(autorId ? { authorId: autorId } : {}),
  };
  const where: Prisma.PostWhereInput = status ? { ...baseWhere, status } : baseWhere;

  const [statusCounts, total, authors] = await Promise.all([
    prisma.post.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.post.count({ where }),
    isStaff
      ? prisma.author.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const countByStatus = new Map(statusCounts.map((c) => [c.status, c._count._all]));
  const totalAll = statusCounts.reduce((acc, c) => acc + c._count._all, 0);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(requestedPage, totalPages);

  const posts = await prisma.post.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      published: true,
      category: true,
      authorName: true,
      updatedAt: true,
    },
  });

  // Views (30d): UMA query agregada só para os posts da página atual.
  const postIds = posts.map((p) => p.id);
  const views =
    postIds.length > 0
      ? await prisma.analyticsEvent.groupBy({
          by: ["postId"],
          where: {
            type: "page_view",
            postId: { in: postIds },
            createdAt: { gte: daysAgo(30) },
          },
          _count: { postId: true },
        })
      : [];
  const viewsByPost = new Map(views.map((v) => [v.postId, v._count.postId]));

  const chips: { label: string; status: PostStatus | null; count: number }[] = [
    { label: "Todos", status: null, count: totalAll },
    ...POST_STATUSES.map((s) => ({
      label: CHIP_LABELS[s],
      status: s,
      count: countByStatus.get(s) ?? 0,
    })),
  ];

  const showingFrom = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const showingTo = Math.min(page * PER_PAGE, total);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#132960]">Conteúdo</h1>
          <p className="text-sm text-[#132960]/60">Posts do blog e fluxo editorial.</p>
        </div>
        <Link
          href="/area-restrita/conteudo/novo"
          className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0268d4]"
        >
          Novo texto
        </Link>
      </div>

      {/* Chips de status com contagem */}
      <div className="mt-6 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = chip.status === status;
          return (
            <Link
              key={chip.label}
              href={buildHref({ q, status: chip.status, autorId })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-transparent bg-[#132960] text-white"
                  : "border-[#132960]/20 bg-white text-[#132960]/75 hover:border-[#132960]/40 hover:text-[#132960]"
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                  active ? "bg-white/15 text-white" : "bg-[#132960]/8 text-[#132960]/60"
                }`}
              >
                {chip.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Busca por título + filtro por autor (GET) */}
      <form
        method="get"
        action="/area-restrita/conteudo"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#132960]/40"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por título…"
            className="w-64 rounded-md border border-[#132960]/20 bg-white py-2 pl-9 pr-3 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
          />
        </div>
        {isStaff ? (
          <select
            name="autor"
            defaultValue={autorId ? String(autorId) : ""}
            aria-label="Filtrar por autor"
            className="rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]"
          >
            <option value="">Todos os autores</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          className="rounded-md border border-[#132960]/20 bg-white px-4 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
        >
          Filtrar
        </button>
        {q || autorId ? (
          <Link
            href={buildHref({ q: "", status, autorId: null })}
            className="text-sm text-[#027DFC] hover:underline"
          >
            Limpar
          </Link>
        ) : null}
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[#132960]/12 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F3F5FB] text-xs uppercase text-[#132960]/55">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  <Eye aria-hidden className="h-3.5 w-3.5" />
                  Views (30d)
                </span>
              </th>
              <th className="px-4 py-3">Atualizado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#132960]/10">
            {posts.map((post) => {
              const isPublished = post.status === "APPROVED" && post.published;
              return (
                <tr key={post.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/area-restrita/conteudo/${post.id}`}
                      className="font-medium text-[#132960] hover:text-[#027DFC]"
                    >
                      {post.title}
                    </Link>
                    <p className="text-xs text-[#132960]/55">{post.authorName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(post.status)}`}
                    >
                      {POST_STATUS_LABELS[post.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#132960]/65">{post.category}</td>
                  <td className="px-4 py-3 tabular-nums text-[#132960]/80">
                    {viewsByPost.get(post.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[#132960]/55">
                    {new Date(post.updatedAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/area-restrita/conteudo/${post.id}`}
                        title="Editar"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#027DFC] transition hover:bg-[#027DFC]/10"
                      >
                        <Pencil aria-hidden className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                      {isPublished ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver no site (nova aba)"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#132960]/70 transition hover:bg-[#132960]/5 hover:text-[#132960]"
                        >
                          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                          Ver no site
                        </a>
                      ) : null}
                      <form action={deletePostAction}>
                        <input type="hidden" name="id" value={post.id} />
                        <ConfirmDialog
                          title="Excluir texto"
                          description={`O texto "${post.title}" será excluído permanentemente. Essa ação não pode ser desfeita.`}
                          triggerLabel="Excluir"
                          triggerClassName="rounded-md px-2 py-1 text-xs font-medium text-[#9C2B24] transition hover:bg-[#9C2B24]/10"
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {posts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#132960]/55">
            {q || status || autorId
              ? "Nenhum texto encontrado com os filtros atuais."
              : "Nenhum texto cadastrado."}
          </p>
        ) : null}
      </div>

      {/* Paginação */}
      {total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#132960]/60">
          <p>
            Mostrando {showingFrom}–{showingTo} de {total}{" "}
            {total === 1 ? "texto" : "textos"}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={buildHref({ q, status, autorId, page: page - 1 })}
                  className="rounded-md border border-[#132960]/20 bg-white px-3 py-1.5 font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
                >
                  Anterior
                </Link>
              ) : (
                <span className="rounded-md border border-[#132960]/10 px-3 py-1.5 text-[#132960]/30">
                  Anterior
                </span>
              )}
              <span className="px-1 tabular-nums">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildHref({ q, status, autorId, page: page + 1 })}
                  className="rounded-md border border-[#132960]/20 bg-white px-3 py-1.5 font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
                >
                  Próxima
                </Link>
              ) : (
                <span className="rounded-md border border-[#132960]/10 px-3 py-1.5 text-[#132960]/30">
                  Próxima
                </span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
