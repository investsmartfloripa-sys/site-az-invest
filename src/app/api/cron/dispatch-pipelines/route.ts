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

type Janela = { check: (now: Date) => boolean; label: string };

function isWeekday(now: Date): boolean {
  const dow = now.getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Pregão da B3: 13h-23h UTC (10h-20h BRT), dias úteis. */
const PREGAO: Janela = {
  label: "fora do pregão",
  check: (now) => isWeekday(now) && now.getUTCHours() >= 13 && now.getUTCHours() < 23,
};

/**
 * Janela de divulgação macro da manhã: 11h-14h UTC (8h-11h BRT), dias úteis.
 * IBGE solta o IPCA ~9h BRT e a FGV o IGP-M ~8h BRT — a janela abre junto com o
 * IGP-M e fecha 2h depois do IPCA. Não vale alargar: cada disparo é um build
 * completo batendo em SIDRA/Olinda, e depois das 11h BRT o cron de segurança do
 * próprio workflow (14:43 UTC) já cobre. Fora da janela o dado é mensal e não
 * muda, então não há o que disparar.
 */
const DIVULGACAO_MANHA: Janela = {
  label: "fora da janela de divulgação",
  check: (now) => isWeekday(now) && now.getUTCHours() >= 11 && now.getUTCHours() < 14,
};

/** Workflows de alta frequência que o GitHub schedule não sustenta. */
const PIPELINES: Array<{ file: string; janela?: Janela }> = [
  // Panorama (yfinance + R) — 24/7, igual ao cron original */15
  { file: "data-pipeline.yml" },
  // FII live (IFIX + screener) — só faz sentido em pregão
  { file: "fii-pipeline-live.yml", janela: PREGAO },
  // Inflação (IPCA + IGP-M) — o cron do GitHub atrasa 74-111 min em MÉDIA
  // (medido em 11/08/2026 sobre o histórico do workflow), e no release do IPCA
  // de julho atrasou 86 min: o número saiu 9h BRT e o site só viraria ~12h40.
  // Aqui o disparo é pontual, de 15 em 15 min na janela da divulgação.
  { file: "ipca-pipeline.yml", janela: DIVULGACAO_MANHA },
];

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
    if (p.janela && !p.janela.check(now)) {
      // `continue` ANTES da contagem: pular por janela não é falha.
      results[p.file] = `skipped (${p.janela.label})`;
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
