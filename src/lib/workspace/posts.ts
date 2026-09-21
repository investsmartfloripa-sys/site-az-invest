import type { Prisma } from "@prisma/client";
import type { PostStatus } from "@prisma/client";
import { BOLETIM_CATEGORY } from "@/data/blog-categories";

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Aguardando revisão",
  APPROVED: "Publicado",
  REJECTED: "Rejeitado",
};

export const publishedPostWhere: Prisma.PostWhereInput = {
  status: "APPROVED",
  published: true,
};

/** Artigos editoriais publicados — exclui os boletins do Publisher. */
export const artigosWhere: Prisma.PostWhereInput = {
  ...publishedPostWhere,
  category: { not: BOLETIM_CATEGORY },
};

/** Boletins (divulgações de indicadores) publicados. */
export const boletinsWhere: Prisma.PostWhereInput = {
  ...publishedPostWhere,
  category: BOLETIM_CATEGORY,
};

export function syncPublishedFields(status: PostStatus) {
  const approved = status === "APPROVED";
  return {
    status,
    published: approved,
    publishedAt: approved ? new Date() : null,
  };
}

export function statusBadgeClass(status: PostStatus) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "PENDING_REVIEW":
      return "bg-amber-100 text-amber-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-[#132960]/10 text-[#132960]/70";
  }
}
