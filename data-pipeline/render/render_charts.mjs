/**
 * Motor de imagens do Publisher — fotografa os gráficos do catálogo e arquiva
 * PNGs numerados no Vercel Blob, uma pasta por divulgação.
 *
 * Fluxo (por indicador):
 *   1. GET  {SITE}/api/render-catalog            → lista de gráficos (ids)
 *   2. GET  blob data/<ind>_release.json          → mes_referencia da divulgação
 *   3. Para cada id: abre {SITE}/render/<id>, espera o stage montar, valida
 *      data-mes == mes_referencia (anti-cache-velho) e fotografa o elemento.
 *   4. PUT  blob releases/<ind>/<mes>/<id>.png   (+ manifest.json + latest.json)
 *
 * Ragged-edge tolerante: falha em um gráfico NÃO derruba os demais — entra na
 * lista `falhas` do manifest. Exit 1 só se NENHUM gráfico do indicador sair ou
 * se o release não existir.
 *
 * Uso:  node data-pipeline/render/render_charts.mjs --indicador ipca|igpm|all
 * Env:  BLOB_READ_WRITE_TOKEN (obrigatória p/ upload)
 *       SITE_BASE  (default https://investimentosdeaz.com.br)
 *       BLOB_BASE  (default https://8ytqvgmik75vk1it.public.blob.vercel-storage.com)
 */
import { chromium } from "playwright";

const SITE_BASE = (process.env.SITE_BASE || "https://investimentosdeaz.com.br").replace(/\/$/, "");
const BLOB_BASE = (
  process.env.BLOB_BASE || "https://8ytqvgmik75vk1it.public.blob.vercel-storage.com"
).replace(/\/$/, "");
const BLOB_WRITE = "https://blob.vercel-storage.com";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

const argIdx = process.argv.indexOf("--indicador");
const alvo = (argIdx >= 0 ? process.argv[argIdx + 1] : "all").toLowerCase();

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) return null;
  return res.json();
}

async function uploadBlob(path, body, contentType) {
  if (!TOKEN) {
    log(`  [upload] SKIP (sem BLOB_READ_WRITE_TOKEN): ${path}`);
    return false;
  }
  // Headers espelham shared/blob_upload.py (x-api-version 7 é o que garante o
  // path FIXO — sem ele a API antiga aplica sufixo aleatório e o GET dá 404).
  const url = `${BLOB_WRITE}/${path}?addRandomSuffix=false&allowOverwrite=true`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "x-api-version": "7",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "Content-Type": contentType,
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT ${path} -> HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  // A resposta traz a URL final — se vier com sufixo, o contrato de path fixo quebrou.
  try {
    const info = await res.json();
    if (info?.url && !info.url.endsWith(`/${path}`)) {
      throw new Error(`PUT ${path} salvou em URL divergente: ${info.url}`);
    }
  } catch (e) {
    if (String(e?.message || "").includes("divergente")) throw e;
    // resposta sem JSON legível: seguir — o verify pós-upload pega qualquer 404.
  }
  return true;
}

/** Espera o conteúdo do stage: SVG do Recharts ("chart") ou qualquer bloco ("dom"). */
async function waitForContent(page, waitFor) {
  if (waitFor === "chart") {
    await page.waitForSelector("#render-stage .recharts-surface", { timeout: 30000 });
  } else {
    // Qualquer conteúdo montado dentro do corpo do stage (tabela, grid, kpi...).
    await page.waitForSelector("#render-stage .p-5 > *", { timeout: 30000 });
  }
  // Settle: animação inicial do Recharts + fontes.
  await page.waitForTimeout(1200);
}

async function renderIndicador(browser, catalogo, indicador) {
  const releasePath = catalogo.releases[indicador];
  const release = await fetchJson(`${BLOB_BASE}/${releasePath}?ts=${Date.now()}`);
  if (!release?.mes_referencia) {
    log(`[${indicadorUp(indicador)}] SEM release no Blob (${releasePath}) — pulando indicador.`);
    return { indicador, mes: null, ok: [], falhas: [{ id: "*", motivo: "release ausente" }] };
  }
  const mes = release.mes_referencia;
  const charts = catalogo.charts.filter((c) => c.indicador === indicador);
  log(`[${indicadorUp(indicador)}] mes_referencia=${mes} · ${charts.length} gráficos`);

  const ok = [];
  const falhas = [];
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1600 },
    deviceScaleFactor: 2,
  });

  for (const chart of charts) {
    const url = `${SITE_BASE}/render/${chart.id}`;
    try {
      let mesRenderizado = null;
      // Até 3 tentativas: a página é force-dynamic, mas CDN/propagação do Blob
      // podem atrasar alguns segundos logo após o upload do pipeline.
      for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector("#render-stage", { timeout: 30000 });
        const stage = page.locator("#render-stage");
        const erro = await stage.getAttribute("data-error");
        if (erro) throw new Error(`stage data-error=${erro}`);
        mesRenderizado = await stage.getAttribute("data-mes");
        if (mesRenderizado === mes) break;
        if (tentativa < 3) {
          log(`  ${chart.id}: mes ${mesRenderizado} != ${mes} — retry ${tentativa}/2 em 20s`);
          await page.waitForTimeout(20000);
        }
      }
      if (mesRenderizado !== mes) {
        throw new Error(`mes renderizado (${mesRenderizado}) != release (${mes})`);
      }
      await waitForContent(page, chart.waitFor);
      const png = await page.locator("#render-stage").screenshot({ type: "png" });
      if (png.length < 20000) {
        throw new Error(`PNG suspeito de vazio (${png.length} bytes)`);
      }
      const blobPath = `releases/${indicador}/${mes}/${chart.id}.png`;
      await uploadBlob(blobPath, png, "image/png");
      ok.push({
        id: chart.id,
        titulo: chart.titulo,
        path: blobPath,
        url: `${BLOB_BASE}/${blobPath}`,
        bytes: png.length,
      });
      log(`  ${chart.id}: OK (${Math.round(png.length / 1024)} KB)`);
    } catch (e) {
      falhas.push({ id: chart.id, motivo: String(e?.message || e).slice(0, 200) });
      log(`  ${chart.id}: FALHOU — ${e?.message || e}`);
    }
  }
  await page.close();

  const manifest = {
    schema_version: 1,
    indicador,
    mes_referencia: mes,
    gerado_em: new Date().toISOString(),
    site_base: SITE_BASE,
    charts: ok,
    falhas,
  };
  const manifestPath = `releases/${indicador}/${mes}/manifest.json`;
  await uploadBlob(manifestPath, JSON.stringify(manifest, null, 2), "application/json");
  await uploadBlob(
    `releases/${indicador}/latest.json`,
    JSON.stringify(
      { mes_referencia: mes, manifest_path: manifestPath, gerado_em: manifest.gerado_em },
      null,
      2,
    ),
    "application/json",
  );
  log(
    `[${indicadorUp(indicador)}] manifest: ${ok.length} ok · ${falhas.length} falhas → ${manifestPath}`,
  );
  return { indicador, mes, ok, falhas };
}

function indicadorUp(s) {
  return s.toUpperCase();
}

async function main() {
  const catalogo = await fetchJson(`${SITE_BASE}/api/render-catalog`);
  if (!catalogo?.charts?.length) {
    log("ERRO: /api/render-catalog vazio ou inacessível.");
    process.exit(1);
  }
  const indicadores =
    alvo === "all" ? [...new Set(catalogo.charts.map((c) => c.indicador))] : [alvo];

  const browser = await chromium.launch();
  const resultados = [];
  for (const ind of indicadores) {
    resultados.push(await renderIndicador(browser, catalogo, ind));
  }
  await browser.close();

  // Verificação pós-upload (doutrina: não confiar no exit code do PUT):
  // rebaixa o latest.json de cada indicador e confere o mes.
  let fatal = false;
  for (const r of resultados) {
    if (!r.mes) continue;
    // Propagação do Blob público leva alguns segundos após o PUT — retry curto.
    let latest = null;
    for (let i = 0; i < 4; i += 1) {
      latest = await fetchJson(`${BLOB_BASE}/releases/${r.indicador}/latest.json?ts=${Date.now()}`);
      if (latest?.mes_referencia === r.mes) break;
      await new Promise((ok) => setTimeout(ok, 8000));
    }
    const confere = latest?.mes_referencia === r.mes;
    log(
      `[verify] ${indicadorUp(r.indicador)}: latest.json ${confere ? "OK" : "DIVERGENTE"} (${latest?.mes_referencia ?? "ausente"})`,
    );
    if (!confere) fatal = true;
    if (r.ok.length === 0) fatal = true;
  }
  if (fatal) {
    log("ERRO: pelo menos um indicador terminou sem nenhum PNG ou com latest divergente.");
    process.exit(1);
  }
  const totalFalhas = resultados.flatMap((r) => r.falhas).length;
  log(`Concluído. Falhas pontuais: ${totalFalhas} (ver manifests).`);
}

main().catch((e) => {
  log(`ERRO FATAL: ${e?.stack || e}`);
  process.exit(1);
});
