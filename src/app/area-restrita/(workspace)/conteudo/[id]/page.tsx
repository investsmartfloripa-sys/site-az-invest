import { notFound } from "next/navigation";
import { PostEditorForm } from "@/components/workspace/PostEditorForm";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPostForSession } from "@/lib/workspace/post-queries";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  published: "Post publicado — peça à equipe editorial para abrir uma revisão.",
  legacy:
    "Salvamento bloqueado para evitar perda de conteúdo: este post legado precisa de migração. Cole o texto completo no editor antes de salvar.",
};

export default async function EditarConteudoPage({ params, searchParams }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const { error } = await searchParams;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const post = await getPostForSession(session, postId);
  if (!post) notFound();

  const authors = await prisma.author.findMany({
    where:
      session.role === "AUTHOR" && session.authorId ? { id: session.authorId } : undefined,
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Editar texto</h1>
      {errorMessage ? (
        <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-6">
        <PostEditorForm session={session} post={post} authors={authors} />
      </div>
    </div>
  );
}
