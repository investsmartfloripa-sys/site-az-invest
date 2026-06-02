import { redirect } from "next/navigation";
import { PostEditorForm } from "@/components/workspace/PostEditorForm";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageAllAuthors } from "@/lib/workspace/permissions";

export default async function NovoConteudoPage() {
  const session = await requireSession();

  if (session.role === "AUTHOR" && !session.authorId) {
    redirect("/area-restrita/perfil?error=no_author");
  }

  const authors = await prisma.author.findMany({
    where: session.role === "AUTHOR" && session.authorId ? { id: session.authorId } : undefined,
    orderBy: { name: "asc" },
  });

  if (authors.length === 0 && canManageAllAuthors(session)) {
    redirect("/area-restrita/autores?error=need_author");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#132960]">Novo texto</h1>
      <p className="mt-1 text-sm text-[#132960]/60">Escreva e envie para revisão quando estiver pronto.</p>
      <div className="mt-6">
        <PostEditorForm session={session} authors={authors} />
      </div>
    </div>
  );
}
