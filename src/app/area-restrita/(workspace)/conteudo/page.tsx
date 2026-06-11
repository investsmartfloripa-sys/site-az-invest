import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listPostsForSession } from "@/lib/workspace/post-queries";
import { POST_STATUS_LABELS, statusBadgeClass } from "@/lib/workspace/posts";

export default async function ConteudoPage() {
  const session = await requireSession();
  const posts = await listPostsForSession(session);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#132960]">Conteúdo</h1>
          <p className="text-sm text-[#132960]/60">Posts do blog e fluxo editorial.</p>
        </div>
        <Link
          href="/area-restrita/conteudo/novo"
          className="rounded-md bg-[#027DFC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0268d4]"
        >
          Novo texto
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-[#132960]/12 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F3F5FB] text-xs uppercase text-[#132960]/55">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#132960]/10">
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/area-restrita/conteudo/${post.id}`}
                    className="font-medium text-[#132960] hover:text-[#027DFC]"
                  >
                    {post.title}
                  </Link>
                  <p className="text-xs text-[#132960]/55">{post.authorName}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(post.status)}`}
                  >
                    {POST_STATUS_LABELS[post.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#132960]/65">{post.category}</td>
                <td className="px-4 py-3 text-[#132960]/55">
                  {new Date(post.updatedAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {posts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#132960]/55">Nenhum texto cadastrado.</p>
        ) : null}
      </div>
    </div>
  );
}
