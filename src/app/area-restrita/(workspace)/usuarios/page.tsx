import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  changeRoleAction,
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  toggleActiveAction,
} from "@/lib/workspace/user-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/workspace/password-policy";
import { SubmitButton } from "@/components/workspace/SubmitButton";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";

const inputClass =
  "mt-1 w-full rounded-md border border-[#132960]/20 bg-white px-3 py-2 text-sm text-[#132960] outline-none focus:border-[#027DFC]";

export default async function UsuariosPage() {
  const session = await requireSession();
  if (!isAdmin(session.role)) redirect("/area-restrita/dashboard");

  const [users, authors] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { author: true },
    }),
    prisma.author.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Usuários</h1>
      <p className="text-sm text-[#132960]/60">Admin, equipe (STAFF) e autores (AUTHOR).</p>

      <section className="mt-6 rounded-lg border border-[#132960]/12 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#132960]">Novo usuário</h2>
        <p className="text-xs text-[#132960]/55">
          Deixe a senha vazia para enviar convite por e-mail (requer Resend).
        </p>
        <form action={createUserAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[#132960]/65">
            E-mail
            <input name="login" type="email" required className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65">
            Nome
            <input name="name" className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65">
            Senha (opcional, mínimo {PASSWORD_MIN_LENGTH} caracteres)
            <input name="password" type="password" minLength={PASSWORD_MIN_LENGTH} className={inputClass} />
          </label>
          <label className="text-sm text-[#132960]/65">
            Papel
            <select name="role" defaultValue="AUTHOR" className={inputClass}>
              <option value="AUTHOR">Autor</option>
              <option value="STAFF">Equipe</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="text-sm text-[#132960]/65 md:col-span-2">
            Perfil de autor (obrigatório para AUTHOR)
            <select name="authorId" defaultValue="" className={inputClass}>
              <option value="">—</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <SubmitButton className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0268d4]">
              Criar
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="mt-8 space-y-3">
        {users.map((user) => {
          const isSelf = user.id === session.userId;
          return (
            <article
              key={user.id}
              className="rounded-lg border border-[#132960]/12 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#132960]">
                    {user.name || user.email}
                    <span className="ml-2 rounded-full bg-[#132960]/10 px-2 py-0.5 text-[10px] uppercase text-[#132960]/70">
                      {user.role}
                    </span>
                    {!user.active ? (
                      <span className="ml-1 text-xs text-red-600">inativo</span>
                    ) : null}
                    {isSelf ? <span className="ml-1 text-xs text-[#132960]/55">(você)</span> : null}
                  </p>
                  <p className="text-xs text-[#132960]/55">{user.email}</p>
                  {user.author ? (
                    <p className="text-xs text-[#132960]/55">Autor: {user.author.name}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={changeRoleAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={user.id} />
                    <select name="role" defaultValue={user.role} disabled={isSelf} className={inputClass}>
                      <option value="AUTHOR">Autor</option>
                      <option value="STAFF">Equipe</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <select
                      name="authorId"
                      defaultValue={user.authorId ?? ""}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      disabled={isSelf}
                      className="rounded border border-[#132960]/25 px-2 py-2 text-xs text-[#132960]/80 hover:bg-[#132960]/5 disabled:opacity-40"
                    >
                      Salvar
                    </SubmitButton>
                  </form>
                  <form action={resetPasswordAction} className="flex items-end gap-1">
                    <input type="hidden" name="id" value={user.id} />
                    <input
                      name="password"
                      type="password"
                      minLength={PASSWORD_MIN_LENGTH}
                      placeholder={`Nova senha (mín. ${PASSWORD_MIN_LENGTH})`}
                      className="w-28 rounded border border-[#132960]/20 bg-white px-2 py-1 text-xs text-[#132960] outline-none focus:border-[#027DFC]"
                    />
                    <SubmitButton className="rounded border border-[#132960]/25 px-2 py-1 text-xs text-[#132960]/80 hover:bg-[#132960]/5">
                      Reset
                    </SubmitButton>
                  </form>
                  <form action={toggleActiveAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <SubmitButton
                      disabled={isSelf}
                      className="rounded border border-[#132960]/25 px-2 py-1 text-xs text-[#132960]/80 hover:bg-[#132960]/5 disabled:opacity-40"
                    >
                      {user.active ? "Desativar" : "Ativar"}
                    </SubmitButton>
                  </form>
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <ConfirmDialog
                      title="Excluir usuário"
                      description={`O acesso de ${user.name || user.email} ao workspace será removido em definitivo. Textos publicados e o perfil de autor vinculado não são apagados.`}
                      confirmLabel="Excluir usuário"
                      triggerLabel="Excluir"
                      disabled={isSelf}
                      triggerClassName="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <p className="mt-6 text-xs text-[#132960]/55">
        <Link href="/area-restrita/recuperar-senha" className="text-[#027DFC] hover:underline">
          Fluxo de recuperação de senha
        </Link>
      </p>
    </div>
  );
}
