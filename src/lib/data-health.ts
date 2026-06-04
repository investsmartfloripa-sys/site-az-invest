import { painelBlobUrl } from "@/lib/painel-blob";
import { prisma } from "@/lib/prisma";
import {
  DATA_SOURCES,
  cadenceSla,
  effectiveAgeMinutes,
  type DataSourceDef,
} from "@/lib/data-manifest";

export { DATA_SOURCES };
export type { DataSourceDef };

type BlobMeta = {
  gerado_em?: string;
  generated_at?: string;
  freshness_status?: string;
  [k: string]: unknown;
};

export type HealthLevel = "ok" | "warn" | "error";

function parseGeneratedAt(json: BlobMeta): Date | null {
  const raw = json.gerado_em || json.generated_at;
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lê um dot-path ("periodo_3m.to") de um objeto JSON arbitrário. */
function readPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const DATA_DATE_FALLBACKS = ["last_data_date", "mes_recente", "trim_recente", "mes_referencia"];

/** Extrai a data do último DADO (não do giro) do payload, como string crua. */
function extractLastDataLabel(json: BlobMeta, source: DataSourceDef): string | null {
  const candidates = source.dataDateField
    ? [source.dataDateField, ...DATA_DATE_FALLBACKS]
    : DATA_DATE_FALLBACKS;
  for (const path of candidates) {
    const value = readPath(json, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function healthFromMeta(
  json: BlobMeta,
  generatedAt: Date | null,
  source: DataSourceDef,
): { level: HealthLevel; freshness: string; error: string | null } {
  const freshness = json.freshness_status;

  if (freshness === "missing") {
    return { level: "error", freshness, error: "Pipeline marcou dados ausentes (freshness_status=missing)" };
  }
  if (freshness === "stale") {
    return { level: "warn", freshness, error: "Pipeline marcou dados desatualizados (freshness_status=stale)" };
  }

  if (generatedAt) {
    const { maxAgeMinutes, business } = cadenceSla(source.cadence);
    const age = effectiveAgeMinutes(generatedAt, new Date(), business);
    if (age > maxAgeMinutes) {
      const ageH = Math.round(age / 60);
      const slaH = Math.round(maxAgeMinutes / 60);
      return {
        level: "error",
        freshness: typeof freshness === "string" ? freshness : "atrasado",
        error: `Giro atrasado: há ${ageH >= 48 ? `${Math.round(ageH / 24)} dias` : `${ageH}h`} sem atualizar (SLA ${slaH >= 48 ? `${Math.round(slaH / 24)} dias` : `${slaH}h`})`,
      };
    }
  } else {
    return { level: "warn", freshness: "sem-metadado", error: "JSON sem gerado_em/generated_at" };
  }

  return { level: "ok", freshness: typeof freshness === "string" ? freshness : "fresh", error: null };
}

type WorkflowInfo = { status: string; url: string; runAt: Date | null };

async function fetchWorkflowStatus(workflowName: string): Promise<WorkflowInfo | null> {
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
    workflow_runs?: Array<{ status: string; conclusion: string | null; html_url: string; run_started_at?: string; created_at?: string }>;
  };
  const run = data.workflow_runs?.[0];
  if (!run) return null;

  const startedRaw = run.run_started_at || run.created_at;
  const runAt = startedRaw ? new Date(startedRaw) : null;
  return {
    status: run.conclusion || run.status,
    url: run.html_url,
    runAt: runAt && !Number.isNaN(runAt.getTime()) ? runAt : null,
  };
}

async function fetchWithTimeout(url: string, ms: number, method: "GET" | "HEAD" = "GET"): Promise<Response> {
  return fetch(url, { method, cache: "no-store", signal: AbortSignal.timeout(ms) });
}

/**
 * Checa uma fonte:
 *  - kind=svg ou heavy=true → HEAD (last-modified como giro, sem meta interna)
 *  - JSON normal → GET + leitura de gerado_em/generated_at, freshness e data do dado
 */
async function probeSource(source: DataSourceDef): Promise<{
  generatedAt: Date | null;
  lastDataLabel: string | null;
  level: HealthLevel;
  freshness: string;
  error: string | null;
}> {
  const url = painelBlobUrl(source.blobPath);
  const headOnly = source.kind === "svg" || source.heavy === true;

  try {
    const res = await fetchWithTimeout(url, 8000, headOnly ? "HEAD" : "GET");
    if (!res.ok) {
      return {
        generatedAt: null,
        lastDataLabel: null,
        level: "error",
        freshness: "missing",
        error: `Blob inacessível (HTTP ${res.status})`,
      };
    }

    if (headOnly) {
      const lm = res.headers.get("last-modified");
      const generatedAt = lm ? new Date(lm) : null;
      const valid = generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt : null;
      if (!valid) {
        return { generatedAt: null, lastDataLabel: null, level: "warn", freshness: "sem-metadado", error: "Sem header last-modified" };
      }
      const health = healthFromMeta({}, valid, source);
      return { generatedAt: valid, lastDataLabel: null, ...health };
    }

    const json = (await res.json()) as BlobMeta;
    const generatedAt = parseGeneratedAt(json);
    const lastDataLabel = extractLastDataLabel(json, source);
    const health = healthFromMeta(json, generatedAt, source);
    return { generatedAt, lastDataLabel, ...health };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { generatedAt: null, lastDataLabel: null, level: "error", freshness: "missing", error: msg };
  }
}

async function refreshOneSource(source: DataSourceDef, workflow: WorkflowInfo | null) {
  const probe = await probeSource(source);

  const row = await prisma.dataSourceSnapshot.upsert({
    where: { key: source.key },
    create: {
      key: source.key,
      label: source.label,
      freshness: probe.freshness,
      generatedAt: probe.generatedAt,
      lastDataLabel: probe.lastDataLabel,
      workflowName: source.workflowName,
      workflowStatus: workflow?.status ?? null,
      workflowUrl: workflow?.url ?? null,
      workflowRunAt: workflow?.runAt ?? null,
      error: probe.error,
    },
    update: {
      label: source.label,
      freshness: probe.freshness,
      generatedAt: probe.generatedAt,
      lastDataLabel: probe.lastDataLabel,
      workflowName: source.workflowName,
      workflowStatus: workflow?.status ?? null,
      workflowUrl: workflow?.url ?? null,
      workflowRunAt: workflow?.runAt ?? null,
      error: probe.error,
      checkedAt: new Date(),
    },
  });

  return { ...row, level: probe.level };
}

export async function refreshDataSourceSnapshots() {
  // 1 chamada de GitHub API por workflow (várias fontes compartilham o mesmo)
  const workflowNames = Array.from(new Set(DATA_SOURCES.map((s) => s.workflowName)));
  const workflowEntries = await Promise.allSettled(
    workflowNames.map(async (name) => [name, await fetchWorkflowStatus(name)] as const),
  );
  const workflows = new Map<string, WorkflowInfo | null>();
  for (const entry of workflowEntries) {
    if (entry.status === "fulfilled") workflows.set(entry.value[0], entry.value[1]);
  }

  const settled = await Promise.allSettled(
    DATA_SOURCES.map((s) => refreshOneSource(s, workflows.get(s.workflowName) ?? null)),
  );

  // Remove snapshots órfãos (fontes que saíram do manifest)
  try {
    await prisma.dataSourceSnapshot.deleteMany({
      where: { key: { notIn: DATA_SOURCES.map((s) => s.key) } },
    });
  } catch {
    // não-crítico
  }

  return settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof refreshOneSource>>> =>
      r.status === "fulfilled",
    )
    .map((r) => r.value);
}
