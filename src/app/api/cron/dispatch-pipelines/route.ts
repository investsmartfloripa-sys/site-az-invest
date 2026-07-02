import { NextResponse } from "next/server";

/**
 * Disparo garantido dos pipelines de 15 minutos.
 *
 * O cron `schedule` do GitHub Actions sofre throttling pesado (medido em
 * 04/06/26: data-pipeline com cron *\/15 rodava a cada 2-5 HORAS). Este
 * endpoint é chamado pelo Vercel Cron a cada 15 min e dispara os workflows
 * via `workflow_dispatch` (API), que é executado imediatamente.
 *
 * Requer na env: CRON_SECRET, GITHUB_TOKEN (PAT escopo repo+workflow),
 * GITHUB_REPOSITORY (owner/repo).
 */

export const dynamic = "force-dynamic";

/** Workflows de alta frequência que o GitHub schedule não sustenta. */
const PIPELINES: Array<{ file: string; onlyMarketHours?: boolean }> = [
  // Panorama (yfinance + R) — 24/7, igual ao cron original */15
  { file: "data-pipeline.yml" },
  // FII live (IFIX + screener) — só faz sentido em pregão (13h-22h UTC, dias úteis)
  { file: "fii-pipeline-live.yml", onlyMarketHours: true },
];

function inMarketWindow(now: Date): boolean {
  const dow = now.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const hour = now.getUTCHours();
  return hour >= 13 && hour < 23;
}

async function dispatchWorkflow(repo: string, token: string, file: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${file}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(8000),
    },
  );
  // 204 = dispatch aceito
  return res.status === 204 ? "dispatched" : `HTTP ${res.status}`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN/GITHUB_REPOSITORY ausentes na env" },
      { status: 500 },
    );
  }

  const now = new Date();
  const results: Record<string, string> = {};
  let failures = 0;
  for (const p of PIPELINES) {
    if (p.onlyMarketHours && !inMarketWindow(now)) {
      results[p.file] = "skipped (fora do pregão)";
      continue;
    }
    try {
      results[p.file] = await dispatchWorkflow(repo, token, p.file);
    } catch (e) {
      results[p.file] = e instanceof Error ? e.message : "erro";
    }
    if (results[p.file] !== "dispatched") failures++;
  }

  // FALHA ALTO: dispatch recusado (ex.: PAT expirado → HTTP 401) responde 500
  // p/ o dashboard de crons da Vercel acusar — antes respondia 200 e o
  // Panorama degradava de 15 min p/ 2-5 h em silêncio.
  if (failures > 0) {
    console.error("[dispatch-pipelines] falhas:", JSON.stringify(results));
    return NextResponse.json(
      { ok: false, at: now.toISOString(), results },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), results });
}
