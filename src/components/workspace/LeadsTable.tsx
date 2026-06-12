"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { baixarCsv } from "@/lib/csv-br";
import {
  setLeadStatusAction,
  type LeadStatusValue,
  type LeadTipo,
} from "@/lib/workspace/lead-actions";

/** Linha unificada das 4 fontes de lead, já serializada para o client. */
export type LeadRow = {
  /** Chave estável `${tipo}-${id}` (ids se repetem entre tabelas). */
  key: string;
  tipo: LeadTipo;
  id: number;
  /** ISO string (Date não atravessa a fronteira server→client serializada como Date). */
  createdAt: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  detalhe: string | null;
  assessor: string | null;
  status: LeadStatusValue;
};

export const LEAD_STATUS_OPTIONS: readonly LeadStatusValue[] = [
  "novo",
  "contactado",
  "convertido",
  "descartado",
];

const STATUS_LABELS: Record<LeadStatusValue, string> = {
  novo: "Novo",
  contactado: "Contactado",
  convertido: "Convertido",
  descartado: "Descartado",
};

const STATUS_SELECT_CLASS: Record<LeadStatusValue, string> = {
  novo: "border-[#027DFC]/40 bg-[#ebf4ff] text-[#027DFC]",
  contactado: "border-amber-300 bg-amber-50 text-amber-700",
  convertido: "border-emerald-300 bg-emerald-50 text-emerald-700",
  descartado: "border-[#132960]/15 bg-[#132960]/5 text-[#132960]/55",
};

const ORIGEM_BADGES: Record<LeadTipo, { label: string; className: string }> = {
  whatsapp: { label: "WhatsApp", className: "bg-emerald-100 text-emerald-700" },
  fii: { label: "FII", className: "bg-[#ebf4ff] text-[#027DFC]" },
  consorcio: { label: "Consórcio", className: "bg-[#FF5713]/12 text-[#FF5713]" },
  form: { label: "Formulário", className: "bg-[#132960]/10 text-[#132960]" },
};

/** Link wa.me com DDI 55: remove não-dígitos e evita duplicar o 55 de números já internacionais. */
function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const full = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

function formatDateTime(iso: string): string {
  // Fuso fixo: o server (UTC na Vercel) e o browser do usuário precisam
  // renderizar o MESMO texto, senão a hidratação do React diverge.
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Lead não encontrado.",
  forbidden: "Você não tem permissão para alterar este lead.",
  migration: "Status indisponível: aguardando aplicação da migration no banco.",
  error: "Não foi possível salvar. Tente novamente.",
};

export function LeadsTable({
  rows,
  statusEnabled,
}: {
  rows: LeadRow[];
  /** false enquanto a migration do LeadStatus não foi aplicada no banco. */
  statusEnabled: boolean;
}) {
  // Override otimista por linha; a fonte da verdade volta do server no próximo load.
  const [statusOverride, setStatusOverride] = useState<Record<string, LeadStatusValue>>({});
  const [, startTransition] = useTransition();

  function statusOf(row: LeadRow): LeadStatusValue {
    return statusOverride[row.key] ?? row.status;
  }

  function handleStatusChange(row: LeadRow, next: LeadStatusValue) {
    const previous = statusOf(row);
    setStatusOverride((current) => ({ ...current, [row.key]: next }));
    startTransition(async () => {
      const result = await setLeadStatusAction(row.tipo, row.id, next);
      if (!result.ok) {
        setStatusOverride((current) => ({ ...current, [row.key]: previous }));
        toast.error("Status não atualizado", {
          description: ERROR_MESSAGES[result.reason],
        });
        return;
      }
      toast.success(`Lead marcado como "${STATUS_LABELS[next]}"`);
    });
  }

  function exportCsv() {
    baixarCsv(
      "leads-az-invest.csv",
      ["Data", "Origem", "Nome", "Telefone", "E-mail", "Detalhe", "Assessor", "Status"],
      rows.map((row) => [
        formatDateTime(row.createdAt),
        ORIGEM_BADGES[row.tipo].label,
        row.nome,
        row.telefone,
        row.email,
        row.detalhe,
        row.assessor,
        STATUS_LABELS[statusOf(row)],
      ]),
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#132960]/60">
          {rows.length} {rows.length === 1 ? "lead" : "leads"} com os filtros atuais.
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm font-medium text-[#132960]/75 transition hover:bg-[#132960]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download aria-hidden className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-[#132960]/12 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F3F5FB] text-xs uppercase text-[#132960]/55">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Detalhe</th>
              <th className="px-3 py-2">Assessor</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#132960]/10">
            {rows.map((row) => {
              const badge = ORIGEM_BADGES[row.tipo];
              const status = statusOf(row);
              const whatsappHref = row.telefone ? waLink(row.telefone) : null;
              return (
                <tr key={row.key} className={status === "descartado" ? "opacity-60" : undefined}>
                  <td className="whitespace-nowrap px-3 py-2 text-[#132960]/65">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-[#132960]">{row.nome}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      {row.telefone ? (
                        whatsappHref ? (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir conversa no WhatsApp"
                            className="whitespace-nowrap font-medium text-emerald-700 hover:underline"
                          >
                            {row.telefone}
                          </a>
                        ) : (
                          <span className="whitespace-nowrap text-[#132960]/80">
                            {row.telefone}
                          </span>
                        )
                      ) : null}
                      {row.email ? (
                        <a
                          href={`mailto:${row.email}`}
                          className="break-all text-[#027DFC] hover:underline"
                        >
                          {row.email}
                        </a>
                      ) : null}
                      {!row.telefone && !row.email ? (
                        <span className="text-[#132960]/40">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-[#132960]/70">
                    <span className="line-clamp-2" title={row.detalhe ?? undefined}>
                      {row.detalhe || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#132960]/70">
                    {row.assessor || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={status}
                      onChange={(e) =>
                        handleStatusChange(row, e.target.value as LeadStatusValue)
                      }
                      disabled={!statusEnabled}
                      title={
                        statusEnabled
                          ? "Status de atendimento"
                          : "aguardando migration"
                      }
                      aria-label={`Status do lead ${row.nome}`}
                      className={`rounded-md border px-2 py-1 text-xs font-medium outline-none transition focus:border-[#027DFC] disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_SELECT_CLASS[status]}`}
                    >
                      {LEAD_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {STATUS_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#132960]/55">
                  Nenhum lead com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
