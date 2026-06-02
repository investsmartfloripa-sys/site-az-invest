import type { SessionUser } from "@/lib/auth";
import { isAdmin, isStaffOrAdmin } from "@/lib/auth";

export function canManageUsers(session: SessionUser) {
  return isAdmin(session.role);
}

export function canManageAllAuthors(session: SessionUser) {
  return isStaffOrAdmin(session.role);
}

export function canViewDataHealth(session: SessionUser) {
  return isAdmin(session.role);
}

export function canReviewPosts(session: SessionUser) {
  return isAdmin(session.role);
}

export function canPublishDirectly(session: SessionUser) {
  return isStaffOrAdmin(session.role);
}

export function canEditPost(
  session: SessionUser,
  post: { authorId: number | null },
) {
  if (isStaffOrAdmin(session.role)) return true;
  if (session.role === "AUTHOR" && session.authorId && post.authorId === session.authorId) {
    return true;
  }
  return false;
}

export function authorScopeWhere(session: SessionUser) {
  if (isStaffOrAdmin(session.role)) return {};
  if (session.role === "AUTHOR" && session.authorId) {
    return { authorId: session.authorId };
  }
  return { authorId: -1 };
}
