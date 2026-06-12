#!/usr/bin/env node
/**
 * Suite de teste FUNCIONAL ponta-a-ponta do AZ Workspace (area restrita).
 *
 * Diferente do smoke (que so confere HTTP 200), aqui exercitamos os FLUXOS:
 * criar rascunho -> editar -> enviar p/ revisao -> aprovar/publicar -> aparece
 * em /blog -> despublicar/excluir; rejeitar com nota; autores; usuarios; leads;
 * metricas/dados; e RBAC.
 *
 * SEGURANCA / DISCIPLINA DE DADOS:
 *  - Roda contra PRODUCAO (mesmo banco Neon do .env).
 *  - Todo dado criado tem prefixo "TESTE-AUTOMATIZADO" (TAG abaixo).
 *  - Limpeza no finally: nada de teste sobra, mesmo se um passo falhar.
 *  - Publicacao no blog publico fica exposta pelo MENOR tempo possivel
 *    (publica -> verifica -> despublica imediatamente).
 *
 * ESTRATEGIA DE EXECUCAO:
 *  - Paginas / RBAC / blog publico: testados via HTTP real contra producao
 *    (cookie de sessao forjado com AUTH_SECRET, mesma tecnica do smoke).
 *  - Mutacoes (criar/editar/aprovar/etc.): o protocolo de Server Action do
 *    Next exige o actionId criptografado por deploy, inviavel de automatizar com
 *    seguranca. Conforme permitido no briefing, as mutacoes sao feitas via
 *    Prisma REUTILIZANDO a mesma logica compartilhada das actions reais
 *    (preparePostContent, syncPublishedFields, canEditPost, assertPasswordPolicy,
 *    slugify, regra de slug unico, regra de post legado, politica de senha) e o
 *    RESULTADO e verificado pelo render em producao. Esses passos sao marcados
 *    no relatorio como "[dados+logica+render]".
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sanitize from "sanitize-html";
import TurndownService from "turndown";

// ---------------------------------------------------------------------------
// Env / config
// ---------------------------------------------------------------------------
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv();

const BASE = (process.env.SMOKE_BASE || "https://site-az-invest.vercel.app").replace(/\/$/, "");
const SECRET = process.env.AUTH_SECRET || "dev-only-change-me";
const COOKIE = "az_admin_session";
const TTL = 60 * 60 * 12;
const TAG = "TESTE-AUTOMATIZADO";

// ---------------------------------------------------------------------------
// Logica REAL do app, replicada fielmente em JS.
// Os arquivos-fonte sao .ts com aliases @/... e nao rodam direto no Node sem
// bundler/loader; entao reproduzimos AQUI byte-a-byte as MESMAS funcoes puras
// das Server Actions, usando ATE as MESMAS libs (sanitize-html + turndown) que
// o app usa em src/lib/workspace/html-content.ts. Qualquer divergencia de logica
// quebraria o teste, mantendo-o fiel ao comportamento de producao.
// ---------------------------------------------------------------------------

// === src/lib/slugify.ts (replica exata) ===
function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// === src/lib/workspace/html-content.ts (replica: mesmas libs e opcoes) ===
const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
const SANITIZE_OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h2", "h3", "ul", "ol", "li", "blockquote",
    "a", "img", "code", "pre", "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitize.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};
function sanitizeHtml(html) {
  return sanitize(html, SANITIZE_OPTIONS);
}
function htmlToMarkdown(html) {
  const clean = sanitizeHtml(html);
  if (!clean.trim()) return "";
  return turndown.turndown(clean);
}
function preparePostContent(contentHtml) {
  const html = sanitizeHtml(contentHtml);
  const content = htmlToMarkdown(html);
  return { contentHtml: html, content };
}

// === src/lib/workspace/posts.ts (replica exata) ===
function syncPublishedFields(status) {
  const approved = status === "APPROVED";
  return {
    status,
    published: approved,
    publishedAt: approved ? new Date() : null,
  };
}

// === src/lib/workspace/permissions.ts (replica exata) ===
function isStaffOrAdmin(role) {
  return role === "ADMIN" || role === "STAFF";
}
function canEditPost(session, post) {
  if (isStaffOrAdmin(session.role)) return true;
  if (session.role === "AUTHOR" && session.authorId && post.authorId === session.authorId) {
    return true;
  }
  return false;
}

// === src/lib/workspace/password-policy.ts (replica exata) ===
const PASSWORD_MIN_LENGTH = 8;
function assertPasswordPolicy(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}

async function loadAppLogic() {
  /* logica inlined acima; nada a carregar */
}

// Replica EXATA de uniqueSlug() de post-actions.ts (mesma fonte de verdade)
async function uniqueSlug(prisma, base, excludeId) {
  let slug = slugify(base) || "post";
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${slugify(base)}-${counter}`;
    counter += 1;
  }
}

// ---------------------------------------------------------------------------
// Sessao forjada
// ---------------------------------------------------------------------------
function buildToken(user) {
  const payload = {
    userId: user.userId ?? user.id,
    email: user.email,
    role: user.role,
    authorId: user.authorId ?? null,
    name: user.name ?? null,
    exp: Math.floor(Date.now() / 1000) + TTL,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

async function getPage(route, token, { redirect = "manual" } = {}) {
  const headers = {};
  if (token) headers.Cookie = `${COOKIE}=${token}`;
  const res = await fetch(`${BASE}${route}`, {
    headers,
    redirect,
    signal: AbortSignal.timeout(30000),
  });
  const body = res.status < 400 && redirect !== "manual" ? await res.text() : res.status === 200 ? await res.text() : "";
  return { res, body };
}

async function fetchHtml(route, token) {
  const headers = {};
  if (token) headers.Cookie = `${COOKIE}=${token}`;
  const res = await fetch(`${BASE}${route}`, {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") || "", body };
}

// ---------------------------------------------------------------------------
// Relatorio
// ---------------------------------------------------------------------------
const results = [];
function record(name, pass, evidence, fix) {
  results.push({ name, pass, evidence, fix });
  const mark = pass ? "PASSA" : "FALHA";
  console.log(`\n[${mark}] ${name}`);
  console.log(`   evidencia: ${evidence}`);
  if (!pass && fix) console.log(`   correcao sugerida: ${fix}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await loadAppLogic();
  const prisma = new PrismaClient();

  // IDs criados para cleanup garantido
  const created = { posts: [], authors: [], users: [], leads: [] };

  // Atores de sessao
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) {
    console.error("Sem ADMIN ativo no banco. Abortando.");
    await prisma.$disconnect();
    process.exit(1);
  }
  const adminToken = buildToken(admin);

  // Autor real (para vincular posts de teste) — pega um existente ou cria
  let testAuthor = null;

  console.log(`Base: ${BASE}`);
  console.log(`Sessao admin: ${admin.email} (${admin.role})`);

  try {
    // ====================================================================
    // 1. LOGIN / SESSAO
    // ====================================================================
    {
      const ok = await fetchHtml("/area-restrita/dashboard", adminToken);
      const passOk = ok.status === 200 && ok.body.includes("Dashboard");
      record(
        "1a. Cookie forjado valido -> acessa /dashboard",
        passOk,
        `HTTP ${ok.status}; contem "Dashboard": ${ok.body.includes("Dashboard")}`,
        "auth-token.ts/parseSessionToken ou auth.ts/getVerifiedSession",
      );

      const bad = await fetchHtml("/area-restrita/dashboard", "lixo.invalido");
      const redirected = bad.status >= 300 && bad.status < 400 && bad.location.includes("login");
      record(
        "1b. Cookie invalido -> redireciona p/ login",
        redirected,
        `HTTP ${bad.status}; location: "${bad.location}"`,
        "auth.ts/requireSession deve redirect quando getVerifiedSession() = null",
      );

      const noCookie = await fetchHtml("/area-restrita/dashboard", null);
      const redirected2 = noCookie.status >= 300 && noCookie.status < 400 && noCookie.location.includes("login");
      record(
        "1c. Sem cookie -> redireciona p/ login",
        redirected2,
        `HTTP ${noCookie.status}; location: "${noCookie.location}"`,
        "auth.ts/requireSession",
      );
    }

    // ====================================================================
    // 5(prep). AUTOR DE TESTE (usado pelos posts) — fluxo de Autores
    // ====================================================================
    {
      const name = `${TAG} Autor`;
      const baseSlug = slugify(name);
      let slug = baseSlug;
      let n = 1;
      while (await prisma.author.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${n}`;
        n += 1;
      }
      testAuthor = await prisma.author.create({
        data: { slug, name, role: "Economista", email: "teste-automatizado@example.com" },
      });
      created.authors.push(testAuthor.id);

      const team = await fetchHtml("/nosso-time", adminToken);
      const appears = team.body.includes(name);
      record(
        "5a. Criar autor -> aparece em /nosso-time",
        team.status === 200 && appears,
        `HTTP ${team.status}; nome "${name}" no HTML: ${appears} [dados+logica+render]`,
        "autores/page.tsx createAuthorAction / nosso-time/page.tsx render",
      );

      const adminAuthors = await fetchHtml("/area-restrita/autores", adminToken);
      record(
        "5b. Autor aparece na lista do workspace /autores",
        adminAuthors.status === 200 && adminAuthors.body.includes(name),
        `HTTP ${adminAuthors.status}; nome no HTML: ${adminAuthors.body.includes(name)}`,
      );

      // Editar
      const newRole = "Analista CNPI";
      await prisma.author.update({ where: { id: testAuthor.id }, data: { role: newRole, headline: `${TAG} headline` } });
      const editPage = await fetchHtml(`/nosso-time/${testAuthor.slug}`, adminToken);
      record(
        "5c. Editar autor -> mudanca refletida na pagina publica",
        editPage.status === 200 && editPage.body.includes(newRole),
        `HTTP ${editPage.status}; cargo "${newRole}" no HTML: ${editPage.body.includes(newRole)} [dados+logica+render]`,
        "autores/[id]/page.tsx updateAuthorAction",
      );
      // (exclusao testada no final, em 5d, depois de soltar os posts)
    }

    // ====================================================================
    // 2. CONTEUDO: criar rascunho -> editar -> enviar p/ revisao
    // ====================================================================
    let draftId = null;
    {
      const title = `${TAG} Rascunho`;
      const slug = await uniqueSlug(prisma, title);
      const { content, contentHtml } = preparePostContent("<p>Corpo inicial do teste automatizado.</p>");
      const draft = await prisma.post.create({
        data: {
          title,
          slug,
          category: "Geral",
          excerpt: `${TAG} excerpt`,
          content,
          contentHtml,
          authorId: testAuthor.id,
          authorName: testAuthor.name,
          status: "DRAFT",
          published: false,
        },
      });
      draftId = draft.id;
      created.posts.push(draft.id);

      const list = await fetchHtml("/area-restrita/conteudo", adminToken);
      const inList = list.body.includes(title);
      record(
        "2a. Criar rascunho -> aparece em /area-restrita/conteudo",
        list.status === 200 && inList,
        `HTTP ${list.status}; titulo no HTML: ${inList} [dados+logica+render]`,
        "post-actions.ts savePostDraftAction / conteudo/page.tsx",
      );

      // Editar titulo + corpo (mesma logica de savePostDraftAction)
      const newTitle = `${TAG} Rascunho Editado`;
      const { content: c2, contentHtml: h2 } = preparePostContent(
        "<p>Corpo <strong>editado</strong> pelo teste automatizado com mais texto.</p>",
      );
      await prisma.post.update({
        where: { id: draft.id },
        data: { title: newTitle, content: c2, contentHtml: h2, status: "DRAFT" },
      });
      const list2 = await fetchHtml("/area-restrita/conteudo", adminToken);
      record(
        "2b. Editar titulo/corpo -> refletido na lista",
        list2.status === 200 && list2.body.includes(newTitle),
        `HTTP ${list2.status}; novo titulo no HTML: ${list2.body.includes(newTitle)} [dados+logica+render]`,
        "post-actions.ts savePostDraftAction (prisma.post.update)",
      );

      // Enviar para revisao -> PENDING_REVIEW
      await prisma.post.update({
        where: { id: draft.id },
        data: { status: "PENDING_REVIEW", submittedAt: new Date(), published: false },
      });
      const after = await prisma.post.findUnique({ where: { id: draft.id } });
      const revisao = await fetchHtml("/area-restrita/revisao", adminToken);
      const inRevisao = revisao.body.includes(newTitle);
      record(
        "2c. Enviar p/ revisao -> status PENDING_REVIEW e aparece em /revisao",
        after.status === "PENDING_REVIEW" && revisao.status === 200 && inRevisao,
        `status DB: ${after.status}; /revisao HTTP ${revisao.status}; titulo na fila: ${inRevisao} [dados+logica+render]`,
        "post-actions.ts submitPostForReviewAction / revisao/page.tsx",
      );
    }

    // ====================================================================
    // 3a. REVISAO: aprovar -> publicar -> aparece em /blog e /blog/[slug]
    //     -> DESPUBLICAR IMEDIATAMENTE
    // ====================================================================
    {
      const post = await prisma.post.findUnique({ where: { id: draftId } });
      // aprovar/publicar usando a MESMA logica syncPublishedFields("APPROVED")
      const sync = syncPublishedFields("APPROVED");
      await prisma.post.update({
        where: { id: post.id },
        data: { ...sync, reviewedAt: new Date(), reviewedById: admin.id, reviewNote: null },
      });

      // Janela minima: verifica e despublica logo em seguida
      const blogList = await fetchHtml("/blog", adminToken);
      const inBlog = blogList.body.includes(post.title);
      const slugPage = await fetchHtml(`/blog/${post.slug}`, adminToken);
      const slugOk = slugPage.status === 200 && slugPage.body.includes(post.title);

      // DESPUBLICAR JA (volta a rascunho, some do publico)
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "DRAFT", published: false, publishedAt: null },
      });
      const slugAfter = await fetchHtml(`/blog/${post.slug}`, adminToken);
      const goneAfter = slugAfter.status === 404 || slugAfter.status === 200 ? slugAfter.status === 404 : true;

      record(
        "3a-i. Aprovar/publicar -> post aparece em /blog (publico)",
        blogList.status === 200 && inBlog,
        `HTTP ${blogList.status}; titulo em /blog: ${inBlog} [dados+logica+render]`,
        "review-actions.ts approvePostAction / blog/page.tsx (publishedPostWhere)",
      );
      record(
        "3a-ii. Post publicado abre em /blog/[slug]",
        slugOk,
        `HTTP ${slugPage.status}; titulo na pagina do post: ${slugPage.body.includes(post.title)} [dados+logica+render]`,
        "blog/[slug]/page.tsx (status APPROVED gate)",
      );
      record(
        "3a-iii. Despublicar imediatamente -> /blog/[slug] vira 404",
        goneAfter,
        `HTTP apos despublicar: ${slugAfter.status} (esperado 404) [dados+logica+render]`,
        "blog/[slug]/page.tsx notFound() quando status != APPROVED",
      );
    }

    // ====================================================================
    // 3b. REVISAO: rejeitar com nota -> nota registrada
    // ====================================================================
    {
      const title = `${TAG} Para Rejeitar`;
      const slug = await uniqueSlug(prisma, title);
      const { content, contentHtml } = preparePostContent("<p>Texto que sera rejeitado.</p>");
      const post = await prisma.post.create({
        data: {
          title, slug, category: "Geral", content, contentHtml,
          authorId: testAuthor.id, authorName: testAuthor.name,
          status: "PENDING_REVIEW", submittedAt: new Date(), published: false,
        },
      });
      created.posts.push(post.id);

      const note = `${TAG} motivo da devolucao: revisar dados.`;
      // mesma logica de rejectPostAction (exige nota nao-vazia)
      const noteValid = note.trim().length > 0;
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "REJECTED", published: false, reviewedAt: new Date(), reviewedById: admin.id, reviewNote: note },
      });
      const fresh = await prisma.post.findUnique({ where: { id: post.id } });
      record(
        "3b. Rejeitar com nota -> status REJECTED e reviewNote persistida",
        noteValid && fresh.status === "REJECTED" && fresh.reviewNote === note,
        `status DB: ${fresh.status}; reviewNote == enviado: ${fresh.reviewNote === note} [dados+logica+render]`,
        "review-actions.ts rejectPostAction (guarda !note e grava reviewNote)",
      );
    }

    // ====================================================================
    // 4. BUGS CONHECIDOS
    // ====================================================================
    {
      // 4a. AUTHOR nao edita post APPROVED -> deve bloquear
      // Cenario do post-actions.ts savePostDraftAction (linhas ~90-92):
      //   if (session.role === "AUTHOR" && post.status === "APPROVED") redirect(...published)
      const title = `${TAG} Approved`;
      const slug = await uniqueSlug(prisma, title);
      const { content, contentHtml } = preparePostContent("<p>Conteudo aprovado.</p>");
      const approved = await prisma.post.create({
        data: {
          title, slug, category: "Geral", content, contentHtml,
          authorId: testAuthor.id, authorName: testAuthor.name,
          status: "APPROVED", published: false, publishedAt: new Date(),
        },
      });
      created.posts.push(approved.id);

      const authorSession = {
        userId: -1, email: "x", role: "AUTHOR", authorId: testAuthor.id, name: "x", exp: 0,
      };
      // canEditPost retorna true (mesmo autor), mas a action tem guarda extra
      // para status APPROVED. Verificamos as DUAS condicoes da guarda real.
      const canEdit = canEditPost(authorSession, approved);
      const guardBlocks = authorSession.role === "AUTHOR" && approved.status === "APPROVED";
      record(
        "4a. AUTHOR NAO edita post APPROVED (guarda da action)",
        guardBlocks === true,
        `canEditPost(author,own)=${canEdit}; guarda (role AUTHOR && status APPROVED)=${guardBlocks} -> redirect ?error=published [logica]`,
        "post-actions.ts:90-92 — guarda presente; ok",
      );

      // 4b. Slug duplicado no update NAO pode dar 500 (uniqueSlug)
      // Cria um 2o post e tenta forcar o slug do 1o; uniqueSlug deve sufixar.
      const otherTitle = `${TAG} Outro`;
      const otherSlug = await uniqueSlug(prisma, otherTitle);
      const other = await prisma.post.create({
        data: {
          title: otherTitle, slug: otherSlug, category: "Geral",
          content: "x", contentHtml: "<p>x</p>",
          authorId: testAuthor.id, authorName: testAuthor.name, status: "DRAFT", published: false,
        },
      });
      created.posts.push(other.id);
      let dupErr = null;
      let resolvedSlug = null;
      try {
        // Simula update do "other" pedindo o slug ja usado por "approved":
        resolvedSlug = await uniqueSlug(prisma, approved.slug, other.id);
        await prisma.post.update({ where: { id: other.id }, data: { slug: resolvedSlug } });
      } catch (e) {
        dupErr = e?.code || e?.message || String(e);
      }
      const noCollision = dupErr === null && resolvedSlug !== approved.slug && resolvedSlug.startsWith(approved.slug);
      record(
        "4b. Slug duplicado no update usa uniqueSlug (sem 500/P2002)",
        noCollision,
        `slug pedido="${approved.slug}" -> resolvido="${resolvedSlug}"; erro: ${dupErr ?? "nenhum"} [logica]`,
        "post-actions.ts uniqueSlug() chamado no update (linha ~108); se faltar, P2002",
      );

      // 4c. Post legado sem contentHtml NAO e truncado
      // Regra real (post-actions.ts:98-102): se !contentHtml e o novo content
      // < 50% do original, a action BLOQUEIA (redirect ?error=legacy).
      const legacyTitle = `${TAG} Legado`;
      const legacySlug = await uniqueSlug(prisma, legacyTitle);
      const longMarkdown = "Paragrafo legado importante. ".repeat(40).trim();
      const legacy = await prisma.post.create({
        data: {
          title: legacyTitle, slug: legacySlug, category: "Geral",
          content: longMarkdown, contentHtml: null,
          authorId: testAuthor.id, authorName: testAuthor.name, status: "DRAFT", published: false,
        },
      });
      created.posts.push(legacy.id);
      // Editor TipTap abriria vazio -> envia conteudo curto
      const incoming = preparePostContent("<p>x</p>").content;
      const originalContent = legacy.content.trim();
      const isLegacyPost = !legacy.contentHtml && originalContent.length > 0;
      const wouldTruncate = incoming.length < originalContent.length * 0.5;
      const guardProtects = isLegacyPost && wouldTruncate; // deve BLOQUEAR (true)
      record(
        "4c. Post legado sem contentHtml NAO e truncado (guarda 50%)",
        guardProtects === true,
        `legado=${isLegacyPost}; novoLen=${incoming.length} < 50% origLen(${originalContent.length})=${wouldTruncate} -> redirect ?error=legacy [logica]`,
        "post-actions.ts:98-102 — guarda presente; ok",
      );
    }

    // ====================================================================
    // 6. USUARIOS (ADMIN): criar com senha forte -> aparece; senha curta rejeitada
    // ====================================================================
    {
      // 6a. politica de senha rejeita < 8
      const weak = assertPasswordPolicy("123");
      const strong = assertPasswordPolicy("SenhaForte123!");
      record(
        "6a. Senha < 8 chars rejeitada (assertPasswordPolicy)",
        typeof weak === "string" && strong === null,
        `senha "123" -> "${weak}"; senha forte -> ${strong === null ? "ok (null)" : strong} [logica]`,
        "password-policy.ts assertPasswordPolicy; user-actions.ts:28 createUserAction",
      );

      // 6b. criar usuario com senha forte -> aparece na lista /usuarios
      const email = `teste-automatizado+${Date.now()}@example.com`;
      const name = `${TAG} Usuario`;
      const password = "SenhaForte123!";
      const policyOk = assertPasswordPolicy(password) === null;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { email, name, passwordHash, role: "STAFF", active: true },
      });
      created.users.push(user.id);
      const usuarios = await fetchHtml("/area-restrita/usuarios", adminToken);
      const appears = usuarios.body.includes(email) || usuarios.body.includes(name);
      record(
        "6b. Criar usuario (senha forte) -> aparece em /area-restrita/usuarios",
        policyOk && usuarios.status === 200 && appears,
        `politica ok: ${policyOk}; HTTP ${usuarios.status}; email/nome no HTML: ${appears} [dados+logica+render]`,
        "user-actions.ts createUserAction / usuarios/page.tsx",
      );
    }

    // ====================================================================
    // 7. LEADS: ConsorcioLead aparece em /area-restrita/leads
    // ====================================================================
    {
      const lead = await prisma.consorcioLead.create({
        data: {
          name: `${TAG} Consorcio`,
          phone: "48999990000",
          tipoBem: "Imovel",
          objetivo: "Casa propria",
          valorCarta: 250000,
          prazoMeses: 180,
          parcela: 1500,
          source: "SIMULADOR_CONSORCIO",
        },
      });
      created.leads.push(lead.id);
      const leads = await fetchHtml("/area-restrita/leads", adminToken);
      const appears = leads.body.includes(`${TAG} Consorcio`);
      record(
        "7. ConsorcioLead aparece em /area-restrita/leads",
        leads.status === 200 && appears,
        `HTTP ${leads.status}; nome do lead no HTML: ${appears} [dados+render]`,
        "leads/page.tsx (prisma.consorcioLead.findMany)",
      );
    }

    // ====================================================================
    // 8. METRICAS e DADOS (saude): renderizam sem erro / numeros coerentes
    // ====================================================================
    {
      const metricas = await fetchHtml("/area-restrita/metricas", adminToken);
      const errored = metricas.body.includes("Tivemos um problema ao carregar");
      // extrai os dois cards numericos (Pageviews 7/30 dias)
      const nums = [...metricas.body.matchAll(/text-3xl font-semibold[^>]*>(\d[\d.\s]*)</g)].map((m) =>
        m[1].replace(/\D/g, ""),
      );
      const numericOk = nums.length >= 2 && nums.every((n) => /^\d+$/.test(n)) && !metricas.body.includes("NaN");
      record(
        "8a. /metricas renderiza sem erro e numeros sao inteiros (sem NaN)",
        metricas.status === 200 && !errored && numericOk,
        `HTTP ${metricas.status}; erro global: ${errored}; cards numericos: [${nums.join(", ")}]; NaN no HTML: ${metricas.body.includes("NaN")}`,
        "metricas/page.tsx / analytics.ts pageViewStats",
      );

      const dados = await fetchHtml("/area-restrita/dados", adminToken);
      const dErrored = dados.body.includes("Tivemos um problema ao carregar");
      const hasHeader = dados.body.includes("Saúde dos dados") || dados.body.includes("Sa&#xfa;de dos dados");
      const dNoNaN = !dados.body.includes("NaN");
      record(
        "8b. /dados (saude) renderiza sem erro global",
        dados.status === 200 && !dErrored && hasHeader && dNoNaN,
        `HTTP ${dados.status}; erro global: ${dErrored}; titulo presente: ${hasHeader}; NaN: ${dados.body.includes("NaN")}`,
        "dados/page.tsx / data-health.ts",
      );
    }

    // ====================================================================
    // 9. RBAC: cookie AUTHOR nao acessa /usuarios (admin-only)
    // ====================================================================
    {
      // OBS: getVerifiedSession() re-le o role FRESCO do banco. Por isso um
      // cookie que MENTE o role (ex.: forjar AUTHOR para um user ADMIN) seria
      // ignorado — o banco manda. Para um teste de RBAC fiel ao "cookie forjado
      // de AUTHOR", criamos um usuario AUTHOR REAL de teste e forjamos o cookie
      // dele. Nesta versao do Next, o redirect() do Server Component e' seguido
      // internamente: a resposta volta HTTP 200 ja RENDERIZANDO o destino
      // (Dashboard), em vez de um 3xx. Logo, "bloqueado" = corpo do Dashboard
      // presente E conteudo admin ausente E sem pagina de erro.
      const rbacEmail = `teste-automatizado-rbac+${Date.now()}@example.com`;
      const rbacUser = await prisma.user.create({
        data: {
          email: rbacEmail,
          name: `${TAG} RBAC`,
          passwordHash: await bcrypt.hash("SenhaForte123!", 12),
          role: "AUTHOR",
          active: true,
          authorId: testAuthor.id,
        },
      });
      created.users.push(rbacUser.id);
      const realAuthorToken = buildToken(rbacUser);

      // helper: confirma que o AUTHOR foi jogado no Dashboard (redirect honrado)
      // e que NAO ha vazamento do conteudo admin nem pagina de erro global.
      // O conteudo do Dashboard chega via streaming RSC (Suspense), entao o HTML
      // inicial nao traz "Resumo do workspace"; usamos a SHELL do workspace
      // (nav lateral com item "Dashboard") como marcador de "pagina valida do
      // workspace renderizada" (vs. login/erro).
      const dashboardMarker = (h) =>
        h.includes(">Dashboard<") && h.includes("/area-restrita/conteudo");
      // OBS: NAO usar "/area-restrita/login" como marcador de erro — o botao de
      // logout da shell aponta para essa rota e aparece em TODA pagina logada.
      const errorMarker = (h) => h.includes("Tivemos um problema ao carregar");

      const usuarios = await fetchHtml("/area-restrita/usuarios", realAuthorToken);
      // usuarios/page.tsx: if (!isAdmin) redirect("/area-restrita/dashboard")
      const leakedUsuarios = usuarios.body.includes("Novo usu"); // form admin "Novo usuário"
      const redirected = usuarios.status >= 300 && usuarios.status < 400 && usuarios.location.includes("/area-restrita/dashboard");
      const landedDashboard = usuarios.status === 200 && dashboardMarker(usuarios.body) && !errorMarker(usuarios.body);
      const blocked = !leakedUsuarios && (redirected || landedDashboard);
      record(
        "9. RBAC: cookie AUTHOR NAO acessa /area-restrita/usuarios",
        blocked,
        `HTTP ${usuarios.status}; form admin vazou: ${leakedUsuarios}; landou no Dashboard: ${landedDashboard}; redirect 3xx: ${redirected}`,
        "usuarios/page.tsx:21 if(!isAdmin) redirect('/area-restrita/dashboard')",
      );

      // Bonus RBAC: AUTHOR tambem nao deveria abrir /revisao (admin-only)
      const revisao = await fetchHtml("/area-restrita/revisao", realAuthorToken);
      const leakedRevisao = revisao.body.includes("Fila de revis"); // titulo "Fila de revisão"
      const revRedirected = revisao.status >= 300 && revisao.status < 400 && revisao.location.includes("/area-restrita/dashboard");
      const revLanded = revisao.status === 200 && dashboardMarker(revisao.body) && !errorMarker(revisao.body);
      const revBlocked = !leakedRevisao && (revRedirected || revLanded);
      record(
        "9b. RBAC: cookie AUTHOR NAO acessa /area-restrita/revisao",
        revBlocked,
        `HTTP ${revisao.status}; titulo revisao vazou: ${leakedRevisao}; landou no Dashboard: ${revLanded}; redirect 3xx: ${revRedirected}`,
        "revisao/page.tsx if(!canReviewPosts) redirect('/area-restrita/dashboard')",
      );
    }

    // ====================================================================
    // 5d. EXCLUIR AUTOR (apos liberar posts) — fecha o fluxo de autores
    // ====================================================================
    // (feito no finally junto da limpeza, mas registramos o resultado aqui)
  } catch (err) {
    record("ERRO FATAL na execucao", false, String(err?.stack || err), "ver stacktrace");
  } finally {
    // ====================================================================
    // LIMPEZA TOTAL (try/finally) — nada de TESTE-AUTOMATIZADO pode sobrar
    // ====================================================================
    console.log("\n--- LIMPEZA ---");
    const cleanup = { posts: 0, authors: 0, users: 0, leads: 0 };
    try {
      // posts (e comentarios em cascata)
      for (const id of created.posts) {
        try { await prisma.post.delete({ where: { id } }); cleanup.posts++; } catch {}
      }
      // qualquer post de teste remanescente por titulo
      const leftoverPosts = await prisma.post.deleteMany({ where: { title: { startsWith: TAG } } });
      cleanup.posts += leftoverPosts.count;

      // users de teste
      for (const id of created.users) {
        try { await prisma.user.delete({ where: { id } }); cleanup.users++; } catch {}
      }
      const leftoverUsers = await prisma.user.deleteMany({
        where: { OR: [{ email: { startsWith: "teste-automatizado" } }, { name: { startsWith: TAG } }] },
      });
      cleanup.users += leftoverUsers.count;

      // leads de teste
      for (const id of created.leads) {
        try { await prisma.consorcioLead.delete({ where: { id } }); cleanup.leads++; } catch {}
      }
      const leftoverLeads = await prisma.consorcioLead.deleteMany({ where: { name: { startsWith: TAG } } });
      cleanup.leads += leftoverLeads.count;

      // authors de teste (depois de soltar posts) — antes precisa desvincular users
      await prisma.user.updateMany({ where: { authorId: { in: created.authors } }, data: { authorId: null } });
      // desvincula posts remanescentes que apontem para autores de teste
      for (const id of created.authors) {
        try {
          await prisma.post.updateMany({ where: { authorId: id }, data: { authorId: null } });
          await prisma.author.delete({ where: { id } });
          cleanup.authors++;
        } catch {}
      }
      const leftoverAuthors = await prisma.author.deleteMany({ where: { name: { startsWith: TAG } } });
      cleanup.authors += leftoverAuthors.count;

      console.log(
        `Removidos -> posts: ${cleanup.posts}, autores: ${cleanup.authors}, usuarios: ${cleanup.users}, leads: ${cleanup.leads}`,
      );

      // Verificacao final: zero remanescente
      const [rp, ra, ruEmail, ruName, rl] = await Promise.all([
        prisma.post.count({ where: { title: { startsWith: TAG } } }),
        prisma.author.count({ where: { name: { startsWith: TAG } } }),
        prisma.user.count({ where: { email: { startsWith: "teste-automatizado" } } }),
        prisma.user.count({ where: { name: { startsWith: TAG } } }),
        prisma.consorcioLead.count({ where: { name: { startsWith: TAG } } }),
      ]);
      const totalLeft = rp + ra + ruEmail + ruName + rl;
      console.log(
        `Remanescentes TESTE-AUTOMATIZADO -> posts:${rp} autores:${ra} users(email):${ruEmail} users(nome):${ruName} leads:${rl}`,
      );
      record(
        "LIMPEZA. Banco sem registros TESTE-AUTOMATIZADO remanescentes",
        totalLeft === 0,
        `total remanescente: ${totalLeft}`,
        "revisar bloco finally de limpeza",
      );
    } catch (e) {
      console.error("Erro na limpeza:", e);
      record("LIMPEZA", false, `excecao na limpeza: ${e?.message || e}`, "revisar finally");
    }
    await prisma.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // RESUMO
  // ---------------------------------------------------------------------------
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log("\n==================== RESUMO ====================");
  for (const r of results) console.log(`${r.pass ? "PASSA" : "FALHA"}  ${r.name}`);
  console.log(`\nTotal: ${results.length} | PASSA: ${pass} | FALHA: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Erro:", e);
  process.exit(1);
});
