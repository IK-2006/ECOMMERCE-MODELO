import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isStaffRole, roleHasPermission, type Permission } from "@/lib/permissions";

// ---------------------------------------------------------------
// Guardas para PÁGINAS (Server Components). Diferente dos guards de
// rota (que lançam 401/403 em JSON), aqui um acesso indevido cai em
// notFound() — mesma convenção do admin/layout.tsx, sem vazar a
// existência da rota para quem não pode vê-la.
//
// Defesa em profundidade: o menu esconde o que o papel não pode, mas
// a página TAMBÉM bloqueia o acesso direto por URL.
// ---------------------------------------------------------------

/** Exige um usuário de equipe (qualquer papel de staff). Retorna o usuário. */
export async function requirePageStaff() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) notFound();
  return user;
}

/** Exige uma permissão específica para renderizar a página. Retorna o usuário. */
export async function requirePagePermission(perm: Permission) {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, perm)) notFound();
  return user;
}
