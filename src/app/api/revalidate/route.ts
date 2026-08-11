import { createHash, timingSafeEqual } from "node:crypto";

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { DATA_SOURCES, getPainel, type DataSourceDef } from "@/lib/data-manifest";
import { blobCacheTag } from "@/lib/painel-blob";

/**
 * Purga sob demanda do cache do painel — chamada pelos pipelines DEPOIS de
 * escrever no Blob.
 *
 * POR QUE EXISTE (bug de 11/08/2026, IPCA de julho): o site lia o Blob por trás
 * de dois caches de 1h empilhados (Data Cache do fetch + ISR da página). O dado
 * novo estava no Blob às 10:47 BRT e a página seguia mostrando junho — o pior
 * caso era ~2h. Esperar TTL vencer é a estratégia errada quando o pipeline sabe
 * a hora exata em que o dado mudou: ele avisa, o site purga na hora.
 *
 * Contrato (POST, `Authorization: Bearer $REVALIDATE_SECRET`):
 *   { "workflow": "ipca-pipeline.yml" }        → tudo que aquele workflow gera
 *   { "blobPaths": ["data/ipca.json"] }        → alvos explícitos
 *   { "paths": ["/blog/ipca-2026-07"] }        → rotas extras fora do manifest
 * Os três campos são combináveis e o resultado é a UNIÃO deles.
 *
 * Resolve os alvos pelo `src/lib/data-manifest.ts` (fonte única de verdade
 * blobPath → workflow → página), então um pipeline novo só precisa se
 * registrar lá — nada muda aqui.
 *
 * Workflow desconhecido responde 200 com `matched: 0` de propósito: workflows
 * que não produzem dado de painel (deploy-vercel, whatsapp-notify) podem
 * chamar sem virar falha vermelha no Actions.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Teto defensivo: a rota é autenticada, mas nada justifica payload gigante. */
const MAX_ITEMS = 200;

type RevalidateBody = {
  /** Nome do arquivo .yml, exatamente como em `workflowName` do manifest. */
  workflow?: string;
  /** Caminhos no Blob, ex.: "data/ipca.json". */
  blobPaths?: string[];
  /** Rotas públicas extras (fora do manifest), ex.: "/blog/ipca-2026-07". */
  paths?: string[];
};

function tokenOk(header: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET?.trim();
  if (!expected) {
    console.error("[revalidate] REVALIDATE_SECRET ausente na env — toda chamada vai dar 401");
    return false;
  }
  if (!header?.startsWith("Bearer ")) return false;
  const got = header.slice("Bearer ".length).trim();
  // Comparação em tempo constante sobre hashes (mesmo padrão de /api/publisher/post).
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

/** Rota pública de uma fonte: a específica quando existe, senão a do painel. */
function pagePathOf(source: DataSourceDef): string | null {
  return source.pagePath ?? getPainel(source.painel)?.pagePath ?? null;
}

export async function POST(req: Request) {
  if (!tokenOk(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: RevalidateBody;
  try {
    body = (await req.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const workflow = typeof body.workflow === "string" ? body.workflow.trim() : "";
  const blobPaths = asStringArray(body.blobPaths);
  const extraPaths = asStringArray(body.paths);

  if (!workflow && blobPaths.length === 0 && extraPaths.length === 0) {
    return NextResponse.json(
      { ok: false, error: "informe workflow, blobPaths ou paths" },
      { status: 400 },
    );
  }

  // Casamento SEMPRE por igualdade exata: "fii-pipeline.yml" e
  // "fii-pipeline-live.yml" são workflows diferentes, com fontes diferentes.
  const matched: DataSourceDef[] = DATA_SOURCES.filter(
    (s) => (workflow && s.workflowName === workflow) || blobPaths.includes(s.blobPath),
  );

  const tags = new Set<string>();
  const pages = new Set<string>();

  for (const source of matched) {
    // Fontes AO VIVO (juros globais) não têm objeto no Blob p/ purgar — só página.
    if (!source.blobPath.startsWith("live:")) tags.add(blobCacheTag(source.blobPath));
    const page = pagePathOf(source);
    if (page) pages.add(page);
  }

  // blobPaths avulsos (fonte ainda não registrada no manifest) também purgam.
  for (const path of blobPaths) {
    if (!path.startsWith("live:")) tags.add(blobCacheTag(path));
  }
  for (const path of extraPaths) {
    if (path.startsWith("/")) pages.add(path);
  }

  // `{ expire: 0 }` é OBRIGATÓRIO aqui. Com o default (ou "max") o Next apenas
  // marca a entrada como STALE: o PRÓXIMO visitante ainda receberia o dado
  // velho enquanto a regeneração roda no fundo — exatamente o sintoma que esta
  // rota existe para eliminar. Ver revalidateTag.md (Next 16.2.4).
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  // O ISR guarda o HTML por rota; a tag sozinha não garante o descarte dele.
  for (const page of pages) revalidatePath(page, "page");

  const result = {
    ok: true,
    at: new Date().toISOString(),
    workflow: workflow || null,
    matched: matched.length,
    tags: [...tags].sort(),
    pages: [...pages].sort(),
  };
  console.info("[revalidate]", JSON.stringify(result));
  return NextResponse.json(result);
}
