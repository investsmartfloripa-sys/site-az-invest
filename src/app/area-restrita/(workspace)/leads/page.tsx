import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorScopeWhere } from "@/lib/workspace/permissions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function LeadsPage() {
  const session = await requireSession();
  const scope = authorScopeWhere(session);
  const authorFilter = scope.authorId ? { authorId: scope.authorId } : {};

  const [whatsapp, fii, consorcio, legacy] = await Promise.all([
    prisma.authorWhatsappClick.findMany({
      where: authorFilter,
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    session.role === "AUTHOR"
      ? []
      : prisma.fiiLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    session.role === "AUTHOR"
      ? []
      : prisma.consorcioLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.authorLead.findMany({
      where: authorFilter,
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Leads</h1>
      <p className="mt-1 text-sm text-[#132960]/60">Contatos e cliques capturados no site.</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[#132960]">Cliques WhatsApp (assessor)</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#132960]/12 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F3F5FB] text-xs uppercase text-[#132960]/55">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Assessor</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Telefone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132960]/10">
              {whatsapp.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-[#132960]/65">
                    {format(row.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-3 py-2 text-[#132960]">{row.author.name}</td>
                  <td className="px-3 py-2 text-[#132960]">{row.name}</td>
                  <td className="px-3 py-2 text-[#132960]/80">{row.phone || "—"}</td>
                </tr>
              ))}
              {whatsapp.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[#132960]/55">
                    Nenhum clique registrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {session.role !== "AUTHOR" ? (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-[#132960]">Leads FII</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#132960]/80">
              {fii.map((l) => (
                <li key={l.id} className="rounded border border-[#132960]/12 bg-white px-3 py-2">
                  {l.name} · {l.email} ·{" "}
                  {format(l.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                </li>
              ))}
              {fii.length === 0 ? <li className="text-[#132960]/55">Sem leads.</li> : null}
            </ul>
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-[#132960]">Leads Consórcio</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#132960]/80">
              {consorcio.map((l) => (
                <li key={l.id} className="rounded border border-[#132960]/12 bg-white px-3 py-2">
                  {l.name} · {l.phone} ·{" "}
                  {format(l.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                </li>
              ))}
              {consorcio.length === 0 ? <li className="text-[#132960]/55">Sem leads.</li> : null}
            </ul>
          </section>
        </>
      ) : null}

      {legacy.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[#132960]">Formulário legado</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#132960]/65">
            {legacy.map((l) => (
              <li key={l.id}>
                {l.name} · {l.email} · {l.author.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
