import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminSessionExpired } from "@/lib/admin-session";
import { isStaffRole, roleHasPermission, type Permission } from "@/lib/permissions";

/** Sessão atual (ou null) — usar em Server Components e Route Handlers. */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Usuário logado ou null.
 *
 * O BANCO é a fonte da verdade do papel e do status (não o JWT), então:
 *  - conta inexistente (removida, banco recriado em dev) → deslogado;
 *  - conta desativada (`active=false`) → deslogado IMEDIATAMENTE, sem
 *    esperar os 30 dias do JWT (revogação de acesso na hora);
 *  - o `role` retornado é o do banco → trocar de papel vale sem novo login.
 */
export async function getCurrentUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active) return null;

  // papel autoritativo do banco (o do JWT pode estar defasado)
  user.role = dbUser.role;
  return user;
}

/** Lança 401 se não houver usuário logado. Retorna o usuário. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Não autenticado");
  return user;
}

/**
 * Garante que a sessão de equipe (admin/staff) ainda está dentro do tempo
 * máximo desde o login. Reutilizado por todos os guards de painel.
 */
async function assertStaffSessionFresh() {
  const session = await getSession();
  if (adminSessionExpired(session?.loginAt)) {
    throw new AuthError(401, "Sessão de administrador expirada. Faça login novamente.");
  }
}

/** Lança 403 se o usuário não for ADMIN. Retorna o usuário. (Compatibilidade.) */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Não autenticado");
  if (user.role !== "ADMIN") throw new AuthError(403, "Acesso restrito a administradores");
  await assertStaffSessionFresh();
  return user;
}

/** Lança 403 se o usuário não for da equipe (staff). Retorna o usuário. */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Não autenticado");
  if (!isStaffRole(user.role)) throw new AuthError(403, "Acesso restrito ao painel");
  await assertStaffSessionFresh();
  return user;
}

/**
 * Lança 403 se o usuário não tiver a permissão informada. Retorna o usuário.
 * ADMIN passa em qualquer permissão (curinga na matriz) — por isso as rotas
 * admin existentes que usam requireAdmin seguem funcionando sem alteração.
 */
export async function requirePermission(perm: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Não autenticado");
  if (!roleHasPermission(user.role, perm)) throw new AuthError(403, "Você não tem permissão para esta ação");
  await assertStaffSessionFresh();
  return user;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
