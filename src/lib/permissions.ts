// ---------------------------------------------------------------
// RBAC — controle de acesso baseado em papéis (Fase 1 do ERP).
//
// Fonte ÚNICA da verdade da matriz papel → permissões. Puro (sem
// Prisma, sem next-auth) para poder ser importado tanto no servidor
// (rotas, guards) quanto no cliente (menu lateral filtrado).
//
// Adicionar um papel ou mexer no que cada um pode fazer = editar
// somente este arquivo. Coerente com o padrão do projeto de tratar
// "enums" como strings validadas.
// ---------------------------------------------------------------

/** Catálogo de permissões, no formato `modulo.acao`. */
export const PERMISSIONS = [
  "dashboard.view",
  "products.read",
  "products.write",
  "stock.read",
  "stock.write",
  "suppliers.write",
  "pos.operate",
  "cash.operate",
  "orders.read",
  "orders.write",
  "customers.read",
  "customers.write",
  "coupons.write",
  "shipping.manage",
  "refunds.manage",
  "reports.read",
  "finance.read", // Fase 2
  "finance.write", // Fase 2
  "purchases.read", // Fase 3
  "purchases.write", // Fase 3
  "fiscal.manage", // Fase 6
  "users.manage",
  "audit.read",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "ADMIN",
  "GERENTE",
  "CAIXA",
  "ESTOQUISTA",
  "FINANCEIRO",
  "CUSTOMER",
] as const;

export type Role = (typeof ROLES)[number];

/** Papéis de equipe — têm acesso ao painel /admin (CUSTOMER não tem). */
export const STAFF_ROLES: readonly Role[] = ["ADMIN", "GERENTE", "CAIXA", "ESTOQUISTA", "FINANCEIRO"];

/** Rótulos PT-BR para exibição na interface. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  CAIXA: "Caixa",
  ESTOQUISTA: "Estoquista",
  FINANCEIRO: "Financeiro",
  CUSTOMER: "Cliente",
};

/** Descrição curta de cada papel (ajuda na tela de usuários). */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Acesso total, incluindo usuários, auditoria e configurações.",
  GERENTE: "Operação completa e relatórios; sem configurações do sistema.",
  CAIXA: "PDV, caixa e consulta de pedidos, produtos e clientes.",
  ESTOQUISTA: "Produtos, estoque, fornecedores e compras.",
  FINANCEIRO: "Financeiro, reembolsos e relatórios.",
  CUSTOMER: "Cliente da loja, sem acesso ao painel.",
};

// GERENTE recebe tudo, menos configurações do sistema (exclusivo do ADMIN).
const GERENTE_PERMS = PERMISSIONS.filter((p) => p !== "settings.manage");

/**
 * Matriz papel → permissões. `"*"` = todas (curinga do ADMIN).
 * Ver documentação em FASE-1-RBAC-DESIGN.md §4.
 */
const MATRIX: Record<Role, readonly Permission[] | "*"> = {
  ADMIN: "*",
  GERENTE: GERENTE_PERMS,
  CAIXA: [
    "dashboard.view",
    "products.read",
    "stock.read",
    "pos.operate",
    "cash.operate",
    "orders.read",
    "customers.read",
    "fiscal.manage",
  ],
  ESTOQUISTA: [
    "dashboard.view",
    "products.read",
    "products.write",
    "stock.read",
    "stock.write",
    "suppliers.write",
    "orders.read",
    "orders.write",
    "shipping.manage",
    "reports.read",
    "purchases.read",
    "purchases.write",
  ],
  FINANCEIRO: [
    "dashboard.view",
    "products.read",
    "stock.read",
    "orders.read",
    "customers.read",
    "refunds.manage",
    "reports.read",
    "finance.read",
    "finance.write",
  ],
  CUSTOMER: [],
};

/** true se o papel possui a permissão informada. */
export function roleHasPermission(role: string | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const perms = MATRIX[role as Role];
  if (!perms) return false;
  if (perms === "*") return true;
  return perms.includes(perm);
}

/** Lista de permissões efetivas de um papel (curinga expandido). */
export function permissionsForRole(role: string | null | undefined): readonly Permission[] {
  if (!role) return [];
  const perms = MATRIX[role as Role];
  if (!perms) return [];
  return perms === "*" ? PERMISSIONS : perms;
}

/** true se o papel é de equipe (pode acessar o /admin). */
export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role as Role);
}

/** true se `role` é um papel conhecido. */
export function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}
