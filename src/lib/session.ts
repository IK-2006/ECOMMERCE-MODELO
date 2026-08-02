import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminSessionExpired } from "@/lib/admin-session";

/** Sessão atual (ou null) — usar em Server Components e Route Handlers. */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Usuário logado ou null.
 * Valida que a conta ainda existe no banco: a sessão (JWT) pode apontar
 * para um usuário que não existe mais (conta removida, banco recriado em
 * dev). Nesse caso tratamos como deslogado — evita erro de FK ao criar
 * carrinho/pedido e leva o usuário a um novo login.
 */
export async function getCurrentUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id) return null;

  const exists = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true },
  });
  return exists ? user : null;
}

/** Lança 401 se não houver usuário logado. Retorna o usuário. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Não autenticado");
  return user;
}

/** Lança 403 se o usuário não for ADMIN. Retorna o usuário. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Não autenticado");
  if (user.role !== "ADMIN") throw new AuthError(403, "Acesso restrito a administradores");
  // limite de duração da sessão admin (mesma regra do middleware)
  const session = await getSession();
  if (adminSessionExpired(session?.loginAt)) {
    throw new AuthError(401, "Sessão de administrador expirada. Faça login novamente.");
  }
  return user;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
