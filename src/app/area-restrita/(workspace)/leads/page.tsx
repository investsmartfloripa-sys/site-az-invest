import type { Prisma } from "@prisma/client";
import { TriangleAlert } from "lucide-react";
import { LeadsTable, type LeadRow } from "@/components/workspace/LeadsTable";
import { daysAgo } from "@/lib/analytics";
import { requireSession } from "@/lib/auth";
import { fmtBRL } from "@/lib/format-br";
import { prisma } from "@/lib/prisma";
import type { LeadStatusValue, LeadTipo } from "@/lib/workspace/lead-actions";
import { authorScopeWhere } from "@/lib/workspace/permissions";

/** Máximo de linhas por fonte e no total — protege a página de bases grandes. */
const PER_SOURCE_LIMIT = 300;
const TOTAL_LIMIT = 500;

const LEAD_TIPOS: readonly LeadTipo[] = ["whatsapp", "fii", "consorcio", "form"];
const LEAD_STATUSES: readonly LeadStatusValue[] = [
  "novo",
  "contactado",
  "convertido",
  "descartado",
];
const JANELAS = ["7", "30", "90", "todos"] as const;
type Janela = (typeof JANELAS)[number];

const ORIGEM_LABELS: Record<LeadTipo, string> = {
  whatsapp: "WhatsApp",
  fii: "FII",
  consorcio: "Consórcio",
  form: "Formulário",
};

type SearchParams = Promise<{
  origem?: string;
  status?: string;
  q?: string;
  janela?: string;
}>;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function joinDetalhe(pieces: (string | null)[]): string | null {
  const filled = pieces.filter((p): p is string => Boolean(p));
  return filled.length > 0 ? filled.join(" · ") : null;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isAuthor = session.role === "AUTHOR";
  const scope = authorScopeWhere(session);
  const authorFilter = scope.authorId ? { authorId: scope.authorId } : {};

  // AUTHOR só enxerga as origens do próprio perfil (whatsapp/formulário).
  const allowedTipos: readonly LeadTipo[] = isAuthor
    ? ["whatsapp", "form"]
    : LEAD_TIPOS;

  const origem = allowedTipos.find((t) => t === params.origem) ?? null;
  const statusFiltro = LEAD_STATUSES.find((s) => s === params.status) ?? null;
  const q = (params.q ?? "").trim();
  const janela: Janela = JANELAS.find((j) => j === params.janela) ?? "30";

  const createdFilter: Prisma.DateTimeFilter | undefined =
    janela === "todos" ? undefined : { gte: daysAgo(Number(janela)) };
  const dateWhere = createdFilter ? { createdAt: createdFilter } : {};
  const nameWhere = q
    ? { name: { contains: q, mode: "insensitive" as const } }
    : {};

  function wants(tipo: LeadTipo) {
    return allowedTipos.includes(tipo) && (!origem || origem === tipo);
  }

  const [whatsapp, fii, consorcio, form] = await Promise.all([
    wants("whatsapp")
      ? prisma.authorWhatsappClick.findMany({
          where: { ...authorFilter, ...dateWhere, ...nameWhere },
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: PER_SOURCE_LIMIT,
        })
      : Promise.resolve([]),
    wants("fii")
      ? prisma.fiiLead.findMany({
          where: { ...dateWhere, ...nameWhere },
          orderBy: { createdAt: "desc" },
          take: PER_SOURCE_LIMIT,
        })
      : Promise.resolve([]),
    wants("consorcio")
      ? prisma.consorcioLead.findMany({
          where: { ...dateWhere, ...nameWhere },
          orderBy: { createdAt: "desc" },
          take: PER_SOURCE_LIMIT,
        })
      : Promise.resolve([]),
    wants("form")
      ? prisma.authorLead.findMany({
          where: { ...authorFilter, ...dateWhere, ...nameWhere },
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: PER_SOURCE_LIMIT,
        })
      : Promise.resolve([]),
  ]);

  let rows: LeadRow[] = [
    ...whatsapp.map(
      (l): LeadRow => ({
        key: `whatsapp-${l.id}`,
        tipo: "whatsapp",
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        nome: l.name,
        telefone: l.phone || null,
        email: null,
        detalhe: "Clique no WhatsApp do assessor",
        assessor: l.author.name,
        status: "novo",
      }),
    ),
    ...fii.map(
      (l): LeadRow => ({
        key: `fii-${l.id}`,
        tipo: "fii",
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        nome: l.name,
        telefone: null,
        email: l.email,
        detalhe: joinDetalhe([
          l.aporteMensal != null ? `Aporte ${fmtBRL(l.aporteMensal, 0)}/mês` : null,
          l.patrimonio != null ? `Patrimônio ${fmtBRL(l.patrimonio, 0)}` : null,
        ]),
        assessor: null,
        status: "novo",
      }),
    ),
    ...consorcio.map(
      (l): LeadRow => ({
        key: `consorcio-${l.id}`,
        tipo: "consorcio",
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        nome: l.name,
        telefone: l.phone,
        email: null,
        detalhe: joinDetalhe([
          l.tipoBem,
          l.valorCarta != null ? `Carta ${fmtBRL(l.valorCarta, 0)}` : null,
          l.prazoMeses != null ? `${l.prazoMeses} meses` : null,
        ]),
        assessor: null,
        status: "novo",
      }),
    ),
    ...form.map(
      (l): LeadRow => ({
        key: `form-${l.id}`,
        tipo: "form",
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        nome: l.name,
        telefone: l.phone || null,
        email: l.email,
        detalhe: l.message ? truncate(l.message, 120) : null,
        assessor: l.author.name,
        status: "novo",
      }),
    ),
  ];

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const capped = rows.length > TOTAL_LIMIT;
  rows = rows.slice(0, TOTAL_LIMIT);

  // UMA query de LeadStatus para todos os leads da página (IN por tipo).
  // try/catch: antes da migration a tabela não existe — todos ficam "novo"
  // e o select é desabilitado na tabela.
  let migrationPending = false;
  const idsByTipo = new Map<LeadTipo, number[]>();
  for (const row of rows) {
    const ids = idsByTipo.get(row.tipo) ?? [];
    ids.push(row.id);
    idsByTipo.set(row.tipo, ids);
  }
  if (rows.length > 0) {
    try {
      const statuses = await prisma.leadStatus.findMany({
        where: {
          OR: [...idsByTipo.entries()].map(([leadTipo, ids]) => ({
            leadTipo,
            leadId: { in: ids },
          })),
        },
        select: { leadTipo: true, leadId: true, status: true },
      });
      const statusByKey = new Map(
        statuses.map((s) => [`${s.leadTipo}-${s.leadId}`, s.status]),
      );
      rows = rows.map((row) => {
        const stored = statusByKey.get(row.key);
        const status = LEAD_STATUSES.find((s) => s === stored) ?? "novo";
        return { ...row, status };
      });
    } catch {
      migrationPending = true;
    }
  }

  if (statusFiltro && !migrationPending) {
    rows = rows.filter((row) => row.status === statusFiltro);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Leads</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        Contatos capturados no site, unificados com status de atendimento.
      </p>

      {migrationPending ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            O status de atendimento ficará disponível após a aplicação da
            migration <code className="font-mono text-xs">lead_status</code> no
            banco. Por enquanto, todos os leads aparecem como &quot;Novo&quot;.
          </p>
        </div>
      ) : null}

      {/* Filtros GET (server-side) */}
      <form
        method="get"
        action="/area-restrita/leads"
        className="mt-5 flex flex-wrap items-end gap-2"
      >
        <label className="text-xs font-medium text-[#132960]/60">
          Origem
          <select
            name="origem"
            defaultValue={origem ?? ""}
            className="mt-1 block rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-normal text-[#132960] outline-none focus:border-[#027DFC]"
          >
            <option value="">Todas</option>
            {allowedTipos.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ORIGEM_LABELS[tipo]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#132960]/60">
          Status
          <select
            name="status"
            defaultValue={statusFiltro ?? ""}
            disabled={migrationPending}
            title={migrationPending ? "aguardando migration" : undefined}
            className="mt-1 block rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-normal text-[#132960] outline-none focus:border-[#027DFC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Todos</option>
            <option value="novo">Novo</option>
            <option value="contactado">Contactado</option>
            <option value="convertido">Convertido</option>
            <option value="descartado">Descartado</option>
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
            <option value="todos">Todos</option>
          </select>
        </label>
        <label className="text-xs font-medium text-[#132960]/60">
          Nome
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome…"
            className="mt-1 block w-52 rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-normal text-[#132960] outline-none focus:border-[#027DFC]"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-[#132960]/20 bg-white px-4 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5"
        >
          Filtrar
        </button>
      </form>

      {capped ? (
        <p className="mt-3 text-xs text-[#132960]/55">
          Mostrando os {TOTAL_LIMIT} leads mais recentes — refine a janela ou a
          busca para ver os demais.
        </p>
      ) : null}

      <div className="mt-5">
        <LeadsTable rows={rows} statusEnabled={!migrationPending} />
      </div>
    </div>
  );
}
