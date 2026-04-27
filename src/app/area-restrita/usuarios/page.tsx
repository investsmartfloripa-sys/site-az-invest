import bcrypt from "bcryptjs";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function createUserAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  if (session.role !== "MASTER") redirect("/area-restrita/painel");

  const login = String(formData.get("login") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "EDITOR").trim();

  if (!login || !password || password.length < 4) return;
  const finalRole = role === "MASTER" ? "MASTER" : "EDITOR";

  const existing = await prisma.user.findUnique({ where: { email: login } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email: login,
      name: name || null,
      passwordHash,
      role: finalRole,
    },
  });

  revalidatePath("/area-restrita/usuarios");
}

async function resetPasswordAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  if (session.role !== "MASTER") redirect("/area-restrita/painel");

  const id = Number(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (!Number.isInteger(id) || password.length < 4) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  revalidatePath("/area-restrita/usuarios");
}

async function changeRoleAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  if (session.role !== "MASTER") redirect("/area-restrita/painel");

  const id = Number(formData.get("id"));
  const role = String(formData.get("role") || "EDITOR").trim();
  const finalRole = role === "MASTER" ? "MASTER" : "EDITOR";
  if (!Number.isInteger(id)) return;

  if (id === session.userId && finalRole !== "MASTER") return;

  await prisma.user.update({ where: { id }, data: { role: finalRole } });
  revalidatePath("/area-restrita/usuarios");
}

async function deleteUserAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  if (session.role !== "MASTER") redirect("/area-restrita/painel");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  if (id === session.userId) return;

  await prisma.user.delete({ where: { id } });
  revalidatePath("/area-restrita/usuarios");
}

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/area-restrita/login");
  if (session.role !== "MASTER") redirect("/area-restrita/painel");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[#132960]">Gerenciar usuarios</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Apenas <span className="font-semibold text-[#FF5713]">MASTER</span> pode acessar esta
            area.
          </p>
        </div>
        <Link
          href="/area-restrita/painel"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Voltar ao painel
        </Link>
      </div>

      <section className="rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Novo usuario</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Editores podem gerenciar posts e autores. Masters podem tudo, inclusive criar/remover
          usuarios.
        </p>
        <form action={createUserAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="login"
            required
            placeholder="Login (e-mail ou usuario)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="name"
            placeholder="Nome (opcional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Senha (min. 4 caracteres)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <select
            name="role"
            defaultValue="EDITOR"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="EDITOR">Editor</option>
            <option value="MASTER">Master</option>
          </select>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-[#132960] px-4 py-2 text-sm font-semibold text-white"
            >
              Criar usuario
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-[#132960]/20 bg-white p-5">
        <h2 className="text-xl text-[#132960]">Usuarios cadastrados</h2>
        <div className="mt-4 space-y-3">
          {users.map((user) => {
            const isSelf = user.id === session.userId;
            return (
              <article
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#132960]">
                    {user.name || user.email}{" "}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        user.role === "MASTER"
                          ? "bg-[#FF5713] text-white"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {user.role}
                    </span>
                    {isSelf ? (
                      <span className="ml-1 text-[11px] font-normal text-zinc-500">(voce)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={changeRoleAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs"
                      disabled={isSelf}
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="MASTER">Master</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isSelf}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Salvar role
                    </button>
                  </form>
                  <form action={resetPasswordAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={user.id} />
                    <input
                      name="password"
                      type="password"
                      placeholder="Nova senha"
                      className="h-8 w-32 rounded-md border border-zinc-300 px-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                    >
                      Resetar
                    </button>
                  </form>
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <button
                      type="submit"
                      disabled={isSelf}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
          {users.length === 0 ? (
            <p className="text-sm text-zinc-500">Sem usuarios.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
