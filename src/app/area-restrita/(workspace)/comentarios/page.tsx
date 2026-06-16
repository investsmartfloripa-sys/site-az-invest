import { requireSession } from "@/lib/auth";
import { listWorkspaceComments } from "@/lib/workspace/comments";
import {
  WorkspaceComments,
  type CommentDTO,
} from "@/components/workspace/WorkspaceComments";

export const dynamic = "force-dynamic";

export default async function ComentariosPage() {
  const session = await requireSession();
  const comments = await listWorkspaceComments(session);

  // Serializa datas para o componente cliente.
  const data: CommentDTO[] = comments.map((c) => ({
    id: c.id,
    name: c.name,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    post: c.post,
    replies: c.replies.map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      authorReply: r.authorReply,
    })),
  }));

  const unanswered = data.filter((c) => c.replies.length === 0).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Comentários</h1>
      <p className="mt-1 text-sm text-[#132960]/60">
        {data.length === 0
          ? "Comentários dos leitores nos seus textos aparecerão aqui."
          : `${data.length} ${data.length === 1 ? "comentário" : "comentários"}` +
            (unanswered > 0 ? ` · ${unanswered} sem resposta` : " · todos respondidos")}
      </p>

      <WorkspaceComments comments={data} />
    </div>
  );
}
