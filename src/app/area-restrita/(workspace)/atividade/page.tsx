import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { daysAgo } from "@/lib/analytics";
import { isStaffOrAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PER_PAGE = 50;

const JANELAS = ["7", "30", "90", "todos"] as const;
type Janela = (typeof JANELAS)[number];

/** Tradução pt-BR das ações gravadas no AuditLog (fallback: código cru). */
const ACTION_LABELS: Record<string, string> = {
  "post.create_draft": "Criou rascunho",
  "post.save_draft": "Salvou rascunho",
  "post.submit_review": "Enviou para revisão",
  "post.approve": "Aprovou e publicou texto",
  "post.reject": "Devolveu texto",
  "post.publish_direct": "Publicou texto diretamente",
  "post.delete": "Excluiu texto",
  "user.create": "Criou usuário",
  "author.update_profile": "Atualizou perfil de autor",
  "lead.set_status": "Alterou status de lead",
};

const ENTITY_LABELS: Record<string, string> = {
  Post: "Texto",
  User: "Usuário",
  Author: "Autor",
  Lead: "Lead",
};

type SearchParams = Promise<{
  acao?: string;
  usuario?: string;
  janela?: string;
  page?: string;
}>;

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function entityLabel(entity: string, entityId: number | null): string {
  const label = ENTITY_LABELS[entity] ?? entity;
  return entityId != null ? `${label} #${entityId}` : label;
}

/** Resume o meta JSON em "chave: valor" legível, truncado. */
function metaSummary(meta: string | null): string | null {
  if (!meta) return null;
  try {
    const parsed: unknown = JSON.parse(meta);
    if (parsed == null || typeof parsed !== "object") return truncate(String(parsed), 80);
    const pairs = Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
      .join(" · ");
    return pairs ? truncate(pairs, 100) : null;
  } catch {
    return truncate(meta, 80);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildHref(params: {
  acao: string | null;
  usuarioId: number | null;
  janela: Janela;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (params.acao) search.set("acao", params.acao);
  if (params.usuarioId) search.set("usuario", String(params.usuarioId));
  if (params.janela !== "todos") search.set("janela", params.janela);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/area-restrita/atividade?${query}` : "/area-restrita/atividade";
}

export default async function AtividadePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  if (!isStaffOrAdmin(session.role)) redirect("/area-restrita/dashboard");

  const params = await searchParams;
  const janela: Janela = JANELAS.find((j) => j === params.janela) ?? "todos";
  const usuarioId =
    Number.isInteger(Number(params.usuario)) && Number(params.usuario) > 0
      ? Number(params.usuario)
      : null;

  // Opções do filtro de ação: as ações realmente presentes no log.
  const [distinctActions, users] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const acao =
    distinctActions.find((a) => a.action === params.acao)?.action ?? null;

  const where: Prisma.AuditLogWhereInput = {
    ...(acao ? { action: acao } : {}),
    ...(usuarioId ? { userId: usuarioId } : {}),
    ...(janela !== "todos" ? { createdAt: { gte: daysAgo(Number(janela)) } } : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  const showingFrom = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const showingTo = Math.min(page * PER_PAGE, total);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Atividade</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Trilha de auditoria do workspace: quem fez o quê e quando.
      </p>

      {/* Filtros GET */}
      <form
        method="get"
        action="/area-restrita/atividade"
        className="mt-5 flex flex-wrap items-end gap-2"
      >
        <label className="text-xs font-medium text-[#132960]/60">
          Ação
          <select
            name="acao"
            defaultValue={acao ?? ""}
            className="mt-1 block max-w-56 rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-normal text-[#132960] outline-none focus:border-[#027DFC]"
          >
            <option value="">Todas</option>
            {distinctActions.map((a) => (
              <option key={a.action} value={a.action}>
                {actionLabel(a.action)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#132960]/60">
          Usuário
          <select
            name="usuario"
            defaultValue={usuarioId ? String(usuarioId) : ""}
            className="mt-1 block max-w-56 rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-normal text-[#132960] outline-none focus:border-[#027DFC]"
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#132960]/60">
          Janela
          <select
            name="janela"
            defaultValue={janela}
            className="mt-1 block rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-normal text-[#132960] outline-none focus:border-[#027DFC]"
          >
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="todos">Todo o período</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-[#132960]/20 bg-white px-4 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
        >
          Filtrar
        </button>
        {acao || usuarioId || janela !== "todos" ? (
          <Link
            href="/area-restrita/atividade"
            className="px-1 py-2 text-sm text-[#027DFC] hover:underline"
          >
            Limpar
          </Link>
        ) : null}
      </form>

      <div className="mt-5 overflow-x-auto rounded-lg border border-[#132960]/12 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F3F5FB] text-xs uppercase text-[#132960]/55">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Alvo</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#132960]/10">
            {logs.map((log) => {
              const meta = metaSummary(log.meta);
              return (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-[#132960]/65">
                    {log.createdAt.toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-[#132960]/80">
                    {log.user?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#132960]">
                    {actionLabel(log.action)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#132960]/70">
                    {entityLabel(log.entity, log.entityId)}
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-[#132960]/60">
                    {meta ? (
                      <span className="line-clamp-2" title={meta}>
                        {meta}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#132960]/55">
            Nenhuma atividade registrada com os filtros atuais.
          </p>
        ) : null}
      </div>

      {/* Paginação */}
      {total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#132960]/60">
          <p>
            Mostrando {showingFrom}–{showingTo} de {total}{" "}
            {total === 1 ? "registro" : "registros"}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={buildHref({ acao, usuarioId, janela, page: page - 1 })}
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
                  href={buildHref({ acao, usuarioId, janela, page: page + 1 })}
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
