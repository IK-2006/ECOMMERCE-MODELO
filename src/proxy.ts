import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { adminSessionExpired } from "@/lib/admin-session";
import { isStaffRole } from "@/lib/permissions";

/**
 * Proteção de rotas:
 *  - /admin/**    somente usuários de EQUIPE (staff) — 404 para os demais
 *                 (não revela a existência do painel). Esta é a checagem
 *                 grossa na borda, com o papel do JWT; a autorização fina
 *                 (por permissão, com o papel do banco) fica no layout, nas
 *                 páginas (requirePagePermission) e nas rotas (requirePermission).
 *  - /conta/**    exige login
 *  - /checkout/** exige login (o carrinho em si funciona sem login)
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (req.nextUrl.pathname.startsWith("/admin")) {
      // não-equipe: 404 (não revela a existência do painel)
      if (!isStaffRole(token?.role)) {
        return NextResponse.rewrite(new URL("/404", req.url));
      }
      // sessão de admin expirada (limite de horas desde o login) → re-login
      if (adminSessionExpired(token?.loginAt)) {
        const url = new URL("/entrar", req.url);
        url.searchParams.set("callbackUrl", req.nextUrl.pathname);
        url.searchParams.set("expirado", "admin");
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/entrar" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/conta/:path*", "/checkout/:path*"],
};
