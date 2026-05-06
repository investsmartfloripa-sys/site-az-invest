import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/area-restrita/login");
}

async function createPostAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");

  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "Geral").trim();
  const authorIdRaw = String(formData.get("authorId") || "").trim();
  const authorIdParsed = authorIdRaw ? Number(authorIdRaw) : null;
  const authorId = authorIdParsed && Number.isInteger(authorIdParsed) ? authorIdParsed : null;
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const coverImage = String(formData.get("coverImage") || "").trim();
  const published = formData.get("published") === "on";

  if (!title || !content || !authorId) return;

  const author = await prisma.author.findUnique({ where: { id: authorId } });
  if (!author) return;

  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.post.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  await prisma.post.create({
    data: {
      title,
      slug,
      category,
      authorName: author.name,
      authorId: author.id,
      excerpt: excerpt || null,
      content,
      coverImage: coverImage || null,
      published,
    },
  });

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/area-restrita/painel");
  revalidatePath(`/nosso-time/${author.slug}`);
}

async function deletePostAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await prisma.post.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/area-restrita/painel");
}

export default async function PainelPage() {
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");

  const [posts, authors, leads, whatsappClicks] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: true },
    }),
    prisma.author.findMany({ orderBy: { name: "asc" } }),
    prisma.authorLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { author: true },
    }),
    prisma.authorWhatsappClick.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { author: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[#132960]">Painel do blog</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Logado como <span className="font-semibold text-[#132960]">{session.email}</span>{" "}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                session.role === "MASTER"
                  ? "bg-[#FF5713] text-white"
                  : "bg-zinc-200 text-zinc-700"
              }`}
            >
              {session.role}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/area-restrita/autores"
            className="rounded-md bg-[#027DFC] px-3 py-2 text-sm font-semibold text-white"
          >
            Gerenciar autores
          </Link>
          {session.role === "MASTER" ? (
            <Link
              href="/area-restrita/usuarios"
              className="rounded-md bg-[#132960] px-3 py-2 text-sm font-semibold text-white"
            >
              Gerenciar usuarios
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              Sair
            </button>
          </form>
        </div>
      </div>

      {authors.length === 0 ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Cadastre pelo menos um autor antes de criar posts.{" "}
          <Link href="/area-restrita/autores" className="font-semibold underline">
            Ir para autores
          </Link>
        </div>
      ) : null}

      <section className="rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Nova postagem</h2>
        <form action={createPostAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="title"
            required
            placeholder="Titulo"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="category"
            required
            placeholder="Categoria"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <select
            name="authorId"
            required
            defaultValue=""
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Selecione o autor
            </option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
          <input
            name="coverImage"
            placeholder="URL da imagem de capa (opcional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="excerpt"
            placeholder="Resumo (opcional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm md:col-span-2"
          />
          <textarea
            name="content"
            required
            placeholder="Conteudo do post"
            className="min-h-40 rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="published" defaultChecked />
            Publicar agora
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-[#132960] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={authors.length === 0}
            >
              Publicar
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Postagens</h2>
        <div className="mt-4 space-y-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 p-3"
            >
              <div>
                <p className="font-semibold text-[#132960]">{post.title}</p>
                <p className="text-xs text-zinc-500">
                  /blog/{post.slug} | autor: {post.author?.name ?? post.authorName} |{" "}
                  {post.published ? "Publicado" : "Rascunho"}
                </p>
              </div>
              <form action={deletePostAction}>
                <input type="hidden" name="id" value={post.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600"
                >
                  Excluir
                </button>
              </form>
            </article>
          ))}
          {posts.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem posts ainda.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-[#132960]/20 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl text-[#132960]">Cliques no WhatsApp dos assessores</h2>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Novo
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Cada vez que algum visitante clica em &quot;Falar com X no WhatsApp&quot;
          informa o nome dele e abre a conversa.
        </p>
        <div className="mt-4 space-y-3">
          {whatsappClicks.map((click) => (
            <article
              key={click.id}
              className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#132960]">{click.name}</p>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  WhatsApp
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Assessor: {click.author.name} |{" "}
                {new Date(click.createdAt).toLocaleString("pt-BR")}
              </p>
            </article>
          ))}
          {whatsappClicks.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem cliques ainda.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Leads de assessoria (historico)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Mensagens enviadas pelo formulario antigo de contato (mantido para
          consulta). O fluxo principal hoje e via WhatsApp acima.
        </p>
        <div className="mt-4 space-y-3">
          {leads.map((lead) => {
            const statusStyle =
              lead.emailStatus === "SENT"
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : lead.emailStatus === "FAILED"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-zinc-100 text-zinc-600 border-zinc-200";
            const statusLabel =
              lead.emailStatus === "SENT"
                ? "E-mail enviado"
                : lead.emailStatus === "FAILED"
                  ? "Falha no envio"
                  : "Salvo (sem envio)";
            return (
              <article
                key={lead.id}
                className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#132960]">
                    {lead.name} - {lead.email}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyle}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Assessor: {lead.author.name} |{" "}
                  {new Date(lead.createdAt).toLocaleString("pt-BR")}
                </p>
                {lead.phone ? (
                  <p className="mt-1 text-xs text-zinc-600">Telefone: {lead.phone}</p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-zinc-700">{lead.message}</p>
              </article>
            );
          })}
          {leads.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem contatos recebidos ainda.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
