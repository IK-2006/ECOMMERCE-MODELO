// ---------------------------------------------------------------
// Limite de duração da sessão de ADMIN.
//
// Por segurança, o "cockpit" administrativo não deve ter sessão
// longa: mesmo que o cookie persista, a sessão de admin expira
// após ADMIN_SESSION_MAX_HORAS (padrão 8h) desde o login, forçando
// re-login. Mais confiável que "fechar o navegador" (que muitos
// usuários nunca fazem, sobretudo no mobile).
//
// Sem estado / sem Prisma → pode ser usado no middleware (edge)
// e no servidor (rotas). Clientes comuns NÃO são afetados.
// ---------------------------------------------------------------

const HOURS = Number(process.env.ADMIN_SESSION_MAX_HOURS) || 8;
export const ADMIN_SESSION_MAX_MS = HOURS * 60 * 60 * 1000;

/** true se a sessão de admin ultrapassou o tempo máximo desde o login. */
export function adminSessionExpired(loginAt?: number | null): boolean {
  return typeof loginAt === "number" && Date.now() - loginAt > ADMIN_SESSION_MAX_MS;
}
