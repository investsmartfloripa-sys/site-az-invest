import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshDataSourceSnapshots } from "@/lib/data-health";
import { canViewDataHealth } from "@/lib/workspace/permissions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

async function refreshAction() {
  "use server";
  const session = await requireSession();
  if (!canViewDataHealth(session)) redirect("/area-restrita/dashboard");
  await refreshDataSourceSnapshots();
  redirect("/area-restrita/dados?refreshed=1");
}

function statusColor(row: { freshness: string | null; error: string | null }) {
  if (row.error?.includes("stale") || row.freshness === "stale") return "text-amber-600";
  if (row.error || row.freshness === "missing") return "text-red-600";
  return "text-emerald-600";
}

export default async function DadosPage({
  searchParams,
}: {
  searchParams: Promise<{ refreshed?: string }>;
}) {
  const session = await requireSession();
  if (!canViewDataHealth(session)) redirect("/area-restrita/dashboard");

  const snapshots = await prisma.dataSourceSnapshot.findMany({ orderBy: { label: "asc" } });
  const params = await searchParams;
  const critical = snapshots.filter(
    (s) => s.freshness === "missing" || s.error?.includes("SLA") || s.freshness === "stale",
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#132960]">Saúde dos dados</h1>
          <p className="text-sm text-[#132960]/60">Painel Econômico — atualização e pipelines.</p>
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

      {critical.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {critical.length} fonte(s) com alerta. Verifique os pipelines no GitHub Actions.
        </div>
      ) : null}

      {snapshots.length === 0 ? (
        <div className="mt-6 rounded-lg border border-[#132960]/12 bg-white p-6 text-center text-sm text-[#132960]/60 shadow-sm">
          Nenhuma verificação ainda. Clique em <span className="font-medium text-[#132960]">Atualizar agora</span> para
          consultar os pipelines.
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {snapshots.map((row) => (
            <article
              key={row.key}
              className="rounded-lg border border-[#132960]/12 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-[#132960]">{row.label}</h2>
                <span className={`text-xs font-semibold uppercase ${statusColor(row)}`}>
                  {row.freshness || "—"}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#132960]/55">
                Gerado:{" "}
                {row.generatedAt
                  ? format(row.generatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "—"}
              </p>
              <p className="text-xs text-[#132960]/55">
                Verificado: {format(row.checkedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
              {row.workflowName ? (
                <p className="mt-1 text-xs text-[#132960]/65">
                  Workflow: {row.workflowName} · {row.workflowStatus || "—"}
                </p>
              ) : null}
              {row.workflowUrl ? (
                <Link
                  href={row.workflowUrl}
                  target="_blank"
                  className="mt-2 inline-block text-xs text-[#027DFC] hover:underline"
                >
                  Ver no GitHub
                </Link>
              ) : null}
              {row.error ? (
                <p className="mt-2 text-xs text-red-600">{row.error}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
