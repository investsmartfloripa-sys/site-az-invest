import { painelBlobUrl } from "@/lib/painel-blob";
import { prisma } from "@/lib/prisma";

export type DataSourceDef = {
  key: string;
  label: string;
  blobPath: string;
  workflowName?: string;
  slaMinutes?: number;
};

export const DATA_SOURCES: DataSourceDef[] = [
  { key: "panorama", label: "Panorama", blobPath: "data/panorama.json", workflowName: "data-pipeline.yml", slaMinutes: 30 },
  { key: "visao_geral", label: "Visão Geral", blobPath: "data/visao_geral.json", workflowName: "visao-geral-pipeline.yml", slaMinutes: 1440 },
  { key: "acoes_ibov", label: "Ações IBOV", blobPath: "data/acoes_ibov.json", workflowName: "acoes-pipeline.yml", slaMinutes: 60 },
  { key: "fii_ifix", label: "FII IFIX", blobPath: "data/fii_ifix.json", workflowName: "fii-pipeline.yml", slaMinutes: 60 },
  { key: "ipca", label: "IPCA", blobPath: "data/ipca.json", workflowName: "ipca-pipeline.yml", slaMinutes: 1440 },
];

type BlobMeta = {
  gerado_em?: string;
  generated_at?: string;
  freshness_status?: string;
};

function parseGeneratedAt(json: BlobMeta): Date | null {
  const raw = json.gerado_em || json.generated_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function healthFromJson(json: BlobMeta, slaMinutes: number) {
  const freshness = json.freshness_status;
  const generatedAt = parseGeneratedAt(json);

  if (freshness === "missing") {
    return { level: "error" as const, freshness, generatedAt, error: "Dados ausentes" };
  }
  if (freshness === "stale") {
    return { level: "warn" as const, freshness, generatedAt, error: "Dados desatualizados (stale)" };
  }

  if (generatedAt && slaMinutes > 0) {
    const ageMin = (Date.now() - generatedAt.getTime()) / 60000;
    if (ageMin > slaMinutes) {
      return {
        level: "error" as const,
        freshness: freshness || "unknown",
        generatedAt,
        error: `Última atualização há ${Math.round(ageMin)} min (SLA ${slaMinutes} min)`,
      };
    }
  }

  return { level: "ok" as const, freshness: freshness || "fresh", generatedAt, error: null };
}

async function fetchWorkflowStatus(workflowName: string) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return null;

  const [owner, name] = repo.split("/");
  if (!owner || !name) return null;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}/actions/workflows/${workflowName}/runs?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      next: { revalidate: 300 },
    },
  );

  if (!res.ok) return null;
  const data = (await res.json()) as {
    workflow_runs?: Array<{ status: string; conclusion: string | null; html_url: string }>;
  };
  const run = data.workflow_runs?.[0];
  if (!run) return null;

  return {
    status: run.conclusion || run.status,
    url: run.html_url,
  };
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) });
}

async function refreshOneSource(source: DataSourceDef) {
  let json: BlobMeta = {};
  let fetchError: string | null = null;

  try {
    const url = painelBlobUrl(source.blobPath);
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) {
      fetchError = `HTTP ${res.status}`;
    } else {
      json = (await res.json()) as BlobMeta;
    }
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "fetch failed";
  }

  const health = fetchError
    ? { level: "error" as const, freshness: "missing", generatedAt: null, error: fetchError }
    : healthFromJson(json, source.slaMinutes ?? 60);

  let workflow = null;
  try {
    workflow = source.workflowName ? await fetchWorkflowStatus(source.workflowName) : null;
  } catch {
    workflow = null;
  }

  const row = await prisma.dataSourceSnapshot.upsert({
      where: { key: source.key },
      create: {
        key: source.key,
        label: source.label,
        freshness: health.freshness,
        generatedAt: health.generatedAt,
        workflowName: source.workflowName ?? null,
        workflowStatus: workflow?.status ?? null,
        workflowUrl: workflow?.url ?? null,
        error: health.error,
      },
      update: {
        label: source.label,
        freshness: health.freshness,
        generatedAt: health.generatedAt,
        workflowName: source.workflowName ?? null,
        workflowStatus: workflow?.status ?? null,
        workflowUrl: workflow?.url ?? null,
        error: health.error,
        checkedAt: new Date(),
      },
    });

  return { ...row, level: health.level };
}

export async function refreshDataSourceSnapshots() {
  const settled = await Promise.allSettled(DATA_SOURCES.map((s) => refreshOneSource(s)));
  return settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof refreshOneSource>>> =>
      r.status === "fulfilled",
    )
    .map((r) => r.value);
}
