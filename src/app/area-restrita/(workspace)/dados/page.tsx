import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshDataSourceSnapshots } from "@/lib/data-health";
import { CADENCE_LABEL, DATA_SOURCES, PAINEIS } from "@/lib/data-manifest";
import { formatDadoLabel, formatGiroMinuto, relativeAge } from "@/lib/data-stamp";
import { canViewDataHealth } from "@/lib/workspace/permissions";

export const dynamic = "force-dynamic";

type Snapshot = {
  key: string;
  freshness: string | null;
  generatedAt: Date | null;
  lastDataLabel: string | null;
  workflowStatus: string | null;
  workflowUrl: string | null;
  workflowRunAt: Date | null;
  error: string | null;
  checkedAt: Date;
};

type Level = "ok" | "warn" | "error" | "unknown";

async function refreshAction() {
  "use server";
  const session = await requireSession();
  if (!canViewDataHealth(session)) redirect("/area-restrita/dashboard");
  await refreshDataSourceSnapshots();
  redirect("/area-restrita/dados?refreshed=1");
}

function levelFromRow(row: Snapshot | undefined): Level {
  if (!row) return "unknown";
  if (row.freshness === "stale" || row.freshness === "sem-metadado") return "warn";
  if (row.error) return "error";
  if (row.workflowStatus && ["failure", "cancelled", "timed_out"].includes(row.workflowStatus)) return "warn";
  return "ok";
}

const LEVEL_ORDER: Record<Level, number> = { error: 0, warn: 1, unknown: 2, ok: 3 };

const DOT_CLASS: Record<Level, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
  unknown: "bg-zinc-300",
};

const LEVEL_LABEL: Record<Level, string> = {
  ok: "OK",
  warn: "Atenção",
  error: "Problema",
  unknown: "Sem verificação",
};

function StatusDot({ level }: { level: Level }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[level]}`} />;
}

function workflowBadge(status: string | null) {
  if (!status) return { text: "—", cls: "text-zinc-400" };
  if (status === "success") return { text: "success", cls: "text-emerald-600" };
  if (["failure", "cancelled", "timed_out"].includes(status)) return { text: status, cls: "text-red-600 font-semibold" };
  return { text: status, cls: "text-amber-600" };
}

export default async function DadosPage({
  searchParams,
}: {
  searchParams: Promise<{ refreshed?: string }>;
}) {
  const session = await requireSession();
  if (!canViewDataHealth(session)) redirect("/area-restrita/dashboard");

  const rows = (await prisma.dataSourceSnapshot.findMany()) as Snapshot[];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const params = await searchParams;

  const withLevel = DATA_SOURCES.map((source) => ({
    source,
    row: byKey.get(source.key),
    level: levelFromRow(byKey.get(source.key)),
  }));

  const problems = withLevel
    .filter((e) => e.level === "error" || e.level === "warn")
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const neverChecked = withLevel.every((e) => !e.row);
  const lastChecked = rows.reduce<Date | null>(
    (acc, r) => (acc === null || r.checkedAt > acc ? r.checkedAt : acc),
    null,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#132960]">Saúde dos dados</h1>
          <p className="text-sm text-[#132960]/60">
            {DATA_SOURCES.length} fontes · {PAINEIS.length} painéis · fluxo workflow → Blob → página
            {lastChecked ? ` · verificado ${relativeAge(lastChecked)}` : ""}
          </p>
        </div>
        <form action={refreshAction}>
          <button
            type="submit"
            className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0268d4]"
          >
            Atualizar agora
          </button>
        </form>
      </div>

      {params.refreshed ? (
        <p className="mt-4 text-sm text-emerald-700">Verificação concluída.</p>
      ) : null}

      {neverChecked ? (
        <div className="mt-6 rounded-lg border border-[#132960]/12 bg-white p-6 text-center text-sm text-[#132960]/60 shadow-sm">
          Nenhuma verificação ainda. Clique em{" "}
          <span className="font-medium text-[#132960]">Atualizar agora</span> para consultar os
          pipelines.
        </div>
      ) : null}

      {problems.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {problems.length} fonte(s) com aviso
          </p>
          <ul className="mt-2 space-y-1">
            {problems.map(({ source, row, level }) => (
              <li key={source.key} className="flex items-baseline gap-2 text-xs text-amber-900/90">
                <StatusDot level={level} />
                <span className="font-medium">{source.label}</span>
                <span className="text-amber-900/60">
                  ({PAINEIS.find((p) => p.key === source.painel)?.label ?? source.painel})
                </span>
                <span className="truncate">{row?.error ?? LEVEL_LABEL[level]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : !neverChecked ? (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Todas as fontes dentro do SLA.
        </div>
      ) : null}

      <div className="mt-6 space-y-5">
        {PAINEIS.map((painel) => {
          const entries = withLevel.filter((e) => e.source.painel === painel.key);
          if (entries.length === 0) return null;
          const worst = entries.reduce<Level>(
            (acc, e) => (LEVEL_ORDER[e.level] < LEVEL_ORDER[acc] ? e.level : acc),
            "ok",
          );
          return (
            <section
              key={painel.key}
              className="overflow-hidden rounded-lg border border-[#132960]/12 bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#132960]/10 bg-[#132960]/[0.03] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <StatusDot level={worst} />
                  <h2 className="text-sm font-semibold text-[#132960]">{painel.label}</h2>
                  <span className="text-xs text-[#132960]/45">
                    {entries.length} fonte{entries.length > 1 ? "s" : ""}
                  </span>
                </div>
                <Link
                  href={painel.pagePath}
                  target="_blank"
                  className="text-xs text-[#027DFC] hover:underline"
                >
                  Ver página →
                </Link>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-[#132960]/40">
                      <th className="px-4 py-2 font-medium">Fonte</th>
                      <th className="px-2 py-2 font-medium">Giro (pipeline)</th>
                      <th className="px-2 py-2 font-medium">Dado</th>
                      <th className="px-2 py-2 font-medium">Cadência</th>
                      <th className="px-2 py-2 font-medium">Workflow</th>
                      <th className="px-4 py-2 font-medium text-right">Run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#132960]/[0.06]">
                    {entries.map(({ source, row, level }) => {
                      const badge = workflowBadge(row?.workflowStatus ?? null);
                      return (
                        <tr key={source.key} className="align-top">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <StatusDot level={level} />
                              <span className="font-medium text-[#132960]">{source.label}</span>
                            </div>
                            {row?.error ? (
                              <p className="mt-1 pl-4 text-[11px] leading-snug text-red-600">
                                {row.error}
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-[#132960]/75">
                            {row?.generatedAt ? (
                              <>
                                {formatGiroMinuto(row.generatedAt)}{" "}
                                <span className="text-[#132960]/40">
                                  · {relativeAge(row.generatedAt)}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-[#132960]/75">
                            {formatDadoLabel(row?.lastDataLabel) ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-[#132960]/55">
                            {CADENCE_LABEL[source.cadence]}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span className={badge.cls}>{badge.text}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right">
                            {row?.workflowUrl ? (
                              <Link
                                href={row.workflowUrl}
                                target="_blank"
                                className="text-[#027DFC] hover:underline"
                              >
                                {row.workflowRunAt ? relativeAge(row.workflowRunAt) : "ver run"}
                              </Link>
                            ) : (
                              <span className="text-[#132960]/35">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-[#132960]/45">
        Giro = última execução do pipeline que gravou o JSON no Blob. Dado = data da observação
        mais recente dentro do arquivo. SLA por cadência; fins de semana são descontados nas
        cadências de dias úteis. Fontes novas devem ser registradas em{" "}
        <code className="rounded bg-[#132960]/5 px-1">src/lib/data-manifest.ts</code>.
      </p>
    </div>
  );
}
