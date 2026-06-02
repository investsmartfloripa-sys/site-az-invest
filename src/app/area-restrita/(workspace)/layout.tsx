import { redirect } from "next/navigation";
import { WorkspaceShell, type WorkspaceNavItem } from "@/components/workspace/WorkspaceShell";
import { destroySession, requireSession, type SessionUser } from "@/lib/auth";
import {
  canManageAllAuthors,
  canManageUsers,
  canReviewPosts,
  canViewDataHealth,
} from "@/lib/workspace/permissions";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/area-restrita/login");
}

function navForSession(session: SessionUser): WorkspaceNavItem[] {
  const items: WorkspaceNavItem[] = [
    { href: "/area-restrita/dashboard", label: "Dashboard" },
    { href: "/area-restrita/conteudo", label: "Conteúdo" },
  ];

  if (canReviewPosts(session)) {
    items.push({ href: "/area-restrita/revisao", label: "Revisão" });
  }

  if (session.role === "AUTHOR") {
    items.push({ href: "/area-restrita/perfil", label: "Meu perfil" });
  }

  if (canManageAllAuthors(session)) {
    items.push({ href: "/area-restrita/autores", label: "Autores" });
  }

  items.push(
    { href: "/area-restrita/leads", label: "Leads" },
    { href: "/area-restrita/metricas", label: "Métricas" },
  );

  if (canViewDataHealth(session)) {
    items.push({ href: "/area-restrita/dados", label: "Saúde dos dados" });
  }

  if (canManageUsers(session)) {
    items.push({ href: "/area-restrita/usuarios", label: "Usuários" });
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

  return (
    <WorkspaceShell
      nav={navForSession(session)}
      roleLabel={roleLabel}
      email={session.email}
      logoutAction={logoutAction}
    >
      {children}
    </WorkspaceShell>
  );
}
