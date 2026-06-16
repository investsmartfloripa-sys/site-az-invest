import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import {
  SIDEBAR_COOKIE_NAME,
  WorkspaceShell,
  type WorkspaceNavItem,
} from "@/components/workspace/WorkspaceShell";
import { FeedbackToaster } from "@/components/workspace/FeedbackToaster";
import { destroySession, requireSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageAllAuthors,
  canManageUsers,
  canReviewPosts,
  canViewDataHealth,
} from "@/lib/workspace/permissions";
import { countUnansweredComments } from "@/lib/workspace/comments";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/area-restrita/login");
}

function navForSession(
  session: SessionUser,
  pendingReviewCount: number,
  unansweredComments: number,
): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = [
    { href: "/area-restrita/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/area-restrita/conteudo", label: "Conteúdo", icon: "conteudo" },
    {
      href: "/area-restrita/comentarios",
      label: "Comentários",
      icon: "comentarios",
      badge: unansweredComments,
    },
  ];

  if (canReviewPosts(session)) {
    items.push({
      href: "/area-restrita/revisao",
      label: "Revisão",
      icon: "revisao",
      badge: pendingReviewCount,
    });
  }

  if (session.role === "AUTHOR") {
    items.push({ href: "/area-restrita/perfil", label: "Meu perfil", icon: "perfil" });
  }

  if (canManageAllAuthors(session)) {
    items.push({ href: "/area-restrita/autores", label: "Autores", icon: "autores" });
  }

  items.push(
    { href: "/area-restrita/leads", label: "Leads", icon: "leads" },
    { href: "/area-restrita/metricas", label: "Métricas", icon: "metricas" },
  );

  if (canManageAllAuthors(session)) {
    items.push({ href: "/area-restrita/atividade", label: "Atividade", icon: "atividade" });
  }

  if (canViewDataHealth(session)) {
    items.push({ href: "/area-restrita/dados", label: "Saúde dos dados", icon: "dados" });
  }

  if (canManageUsers(session)) {
    items.push({ href: "/area-restrita/usuarios", label: "Usuários", icon: "usuarios" });
  }

  return items;
}

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const roleLabel =
    session.role === "ADMIN" ? "Admin" : session.role === "STAFF" ? "Equipe" : "Autor";

  // Estado da sidebar lido no server para o rail não piscar no primeiro paint.
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value === "1";

  // Badges numéricos: "Revisão" (textos aguardando) e "Comentários" (sem resposta).
  const [pendingReviewCount, unansweredComments] = await Promise.all([
    canReviewPosts(session)
      ? prisma.post.count({ where: { status: "PENDING_REVIEW" } })
      : Promise.resolve(0),
    countUnansweredComments(session),
  ]);

  return (
    <WorkspaceShell
      nav={navForSession(session, pendingReviewCount, unansweredComments)}
      roleLabel={roleLabel}
      email={session.email}
      name={session.name}
      profileHref={session.role === "AUTHOR" ? "/area-restrita/perfil" : null}
      defaultCollapsed={sidebarCollapsed}
      logoutAction={logoutAction}
    >
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: { borderRadius: "12px" },
        }}
      />
      <Suspense fallback={null}>
        <FeedbackToaster />
      </Suspense>
    </WorkspaceShell>
  );
}
