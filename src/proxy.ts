import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { adminSessionExpired } from "@/lib/admin-session";

/**
 * Proteção de rotas:
 *  - /admin/**    somente usuários com role ADMIN (404 para os demais —
 *                 não revela a existência do painel)
 *  - /conta/**    exige login
 *  - /checkout/** exige login (o carrinho em si funciona sem login)
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (req.nextUrl.pathname.startsWith("/admin")) {
      // não-admin: 404 (não revela a existência do painel)
      if (token?.role !== "ADMIN") {
        return NextResponse.rewrite(new URL("/404", req.url));
      }
      // sessão de admin expirada (limite de horas desde o login) → re-login
      if (adminSessionExpired(token.loginAt)) {
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
