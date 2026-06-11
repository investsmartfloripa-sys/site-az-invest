import { notFound } from "next/navigation";
import { PostEditorForm } from "@/components/workspace/PostEditorForm";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPostForSession } from "@/lib/workspace/post-queries";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditarConteudoPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

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
      <div className="mt-6">
        <PostEditorForm session={session} post={post} authors={authors} />
      </div>
    </div>
  );
}
