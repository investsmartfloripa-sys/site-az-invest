import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BOLETIM_BASE_PATH, BOLETIM_SLUG_PATTERN } from "@/data/blog-categories";

const SESSION_COOKIE_NAME = "az_admin_session";

const PUBLIC_PATHS = [
  "/area-restrita/login",
  "/area-restrita/ativar",
  "/area-restrita/recuperar-senha",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Boletins do Publisher moraram em /blog/<slug> até set/2026; links já
  // circularam no WhatsApp. 308 de verdade aqui (a página só consegue
  // meta-refresh por causa do streaming do blog/loading.tsx).
  if (pathname.startsWith("/blog/")) {
    const slug = pathname.slice("/blog/".length);
    if (BOLETIM_SLUG_PATTERN.test(slug)) {
      return NextResponse.redirect(new URL(`${BOLETIM_BASE_PATH}/${slug}`, request.url), 308);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/area-restrita")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const login = new URL("/area-restrita/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/area-restrita/:path*", "/blog/:slug"],
};
