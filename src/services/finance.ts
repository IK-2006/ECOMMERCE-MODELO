import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------
// Financeiro (Fase 2). Um único modelo de lançamento (FinancialEntry)
// descreve a pagar / a receber / realizado — cada relatório é um filtro.
//
// Integração com o núcleo (vendas, compras) via helpers idempotentes
// chamados DENTRO das transações existentes, no mesmo padrão do
// recordMovement de estoque. Nunca altera regra de negócio: só acrescenta
// um lançamento, e é no-op quando o financeiro não está configurado.
// ---------------------------------------------------------------

type Tx = Prisma.TransactionClient;

export const ACCOUNT_KINDS = ["CAIXA", "BANCO", "GATEWAY"] as const;

// Contas e categorias padrão (criadas sob demanda — idempotente).
const DEFAULT_ACCOUNTS: Array<{ name: string; kind: string }> = [
  { name: "Caixa da loja", kind: "CAIXA" },
  { name: "Banco", kind: "BANCO" },
  { name: "Mercado Pago", kind: "GATEWAY" },
];
const DEFAULT_CATEGORIES: Array<{ name: string; type: string }> = [
  { name: "Vendas", type: "INCOME" },
  { name: "Fornecedores", type: "EXPENSE" },
  { name: "Despesas", type: "EXPENSE" },
];

/**
 * Garante as contas/categorias padrão. Idempotente: só cria o que falta.
 * Chamada ao abrir o módulo financeiro — a partir daí as vendas pagas já
 * caem automaticamente na conta certa.
 */
export async function ensureFinanceDefaults(): Promise<void> {
  for (const acc of DEFAULT_ACCOUNTS) {
    const exists = await prisma.financialAccount.findFirst({ where: { kind: acc.kind } });
    if (!exists) await prisma.financialAccount.create({ data: acc });
  }
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.financialCategory.upsert({
      where: { name_type: { name: cat.name, type: cat.type } },
      update: {},
      create: cat,
    });
  }
}

/** Conta padrão para o pagamento de uma venda (dinheiro→Caixa, pix/cartão→Banco, online→Gateway). */
function accountKindForSale(channel: string, paymentMethod: string | null): string {
  if (channel === "LOJA") return paymentMethod === "dinheiro" ? "CAIXA" : "BANCO";
  return "GATEWAY";
}

export interface SaleOrderLike {
  id: string;
  number: string;
  totalCents: number;
  channel: string;
  paymentMethod: string | null;
  paidAt: Date | null;
}

/**
 * Lança a RECEITA de uma venda paga (realizada). Idempotente pelo sourceKey
 * `order:<id>:income`. No-op se não houver conta configurada para o tipo.
 * Roda dentro da transação da venda (loja) ou da mudança de status (online).
 */
export async function postSaleIncome(tx: Tx, order: SaleOrderLike): Promise<void> {
  const sourceKey = `order:${order.id}:income`;
  const existing = await tx.financialEntry.findUnique({ where: { sourceKey } });
  if (existing) return;

  const kind = accountKindForSale(order.channel, order.paymentMethod);
  const account = await tx.financialAccount.findFirst({
    where: { kind, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!account) return; // financeiro não configurado → não faz nada

  const category = await tx.financialCategory.findFirst({
    where: { name: "Vendas", type: "INCOME" },
  });
  const when = order.paidAt ?? new Date();

  await tx.financialEntry.create({
    data: {
      direction: "INCOME",
      status: "PAID",
      amountCents: order.totalCents,
      description: `Venda ${order.number}`,
      paidDate: when,
      dueDate: when,
      accountId: account.id,
      categoryId: category?.id ?? null,
      orderId: order.id,
      sourceKey,
    },
  });
}

/** Estorna a receita de uma venda (pedido cancelado/reembolsado). Idempotente. */
export async function cancelSaleIncome(tx: Tx, orderId: string): Promise<void> {
  await tx.financialEntry.updateMany({
    where: { orderId, direction: "INCOME", status: "PAID" },
    data: { status: "CANCELED" },
  });
}

/** Cria a conta a pagar de uma entrada de mercadoria (compra). No-op se custo total = 0. */
export async function postPurchasePayable(
  tx: Tx,
  params: { supplierId: string | null; amountCents: number; description: string; createdById?: string | null }
): Promise<void> {
  if (params.amountCents <= 0) return;
  const category = await tx.financialCategory.findFirst({
    where: { name: "Fornecedores", type: "EXPENSE" },
  });
  await tx.financialEntry.create({
    data: {
      direction: "EXPENSE",
      status: "PENDING",
      amountCents: params.amountCents,
      description: params.description,
      supplierId: params.supplierId,
      categoryId: category?.id ?? null,
      createdById: params.createdById ?? null,
    },
  });
}

// ----------------------------- Lançamentos manuais -----------------------------

export interface EntryInput {
  direction: "INCOME" | "EXPENSE";
  amountCents: number;
  description: string;
  categoryId?: string | null;
  accountId?: string | null;
  supplierId?: string | null;
  dueDate?: Date | null;
  status?: "PENDING" | "PAID";
  paidDate?: Date | null;
}

/** Cria um lançamento manual (a pagar/receber ou já realizado). */
export async function createEntry(input: EntryInput, createdById: string) {
  const isPaid = input.status === "PAID";
  return prisma.financialEntry.create({
    data: {
      direction: input.direction,
      status: isPaid ? "PAID" : "PENDING",
      amountCents: input.amountCents,
      description: input.description,
      categoryId: input.categoryId || null,
      accountId: isPaid ? input.accountId || null : null,
      supplierId: input.supplierId || null,
      dueDate: input.dueDate ?? null,
      paidDate: isPaid ? input.paidDate ?? new Date() : null,
      createdById,
    },
  });
}

/** Liquida um lançamento pendente (PENDING → PAID), definindo a conta e a data. */
export async function settleEntry(id: string, params: { accountId: string; paidDate?: Date | null }) {
  const entry = await prisma.financialEntry.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, "Lançamento não encontrado");
  if (entry.status !== "PENDING") throw new ApiError(409, "Este lançamento não está pendente.");
  return prisma.financialEntry.update({
    where: { id },
    data: { status: "PAID", accountId: params.accountId, paidDate: params.paidDate ?? new Date() },
  });
}

/** Cancela um lançamento (PENDING/PAID → CANCELED). */
export async function cancelEntry(id: string) {
  const entry = await prisma.financialEntry.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, "Lançamento não encontrado");
  if (entry.status === "CANCELED") return entry;
  return prisma.financialEntry.update({ where: { id }, data: { status: "CANCELED" } });
}

// ----------------------------- Relatórios -----------------------------

/** Saldo de cada conta (Σ receitas − Σ despesas realizadas). */
export async function accountBalances() {
  const accounts = await prisma.financialAccount.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const results = [];
  for (const acc of accounts) {
    const paid = await prisma.financialEntry.findMany({
      where: { accountId: acc.id, status: "PAID" },
      select: { direction: true, amountCents: true },
    });
    const balanceCents = paid.reduce(
      (s, e) => s + (e.direction === "INCOME" ? e.amountCents : -e.amountCents),
      0
    );
    results.push({ id: acc.id, name: acc.name, kind: acc.kind, balanceCents });
  }
  return results;
}

/** Fluxo de caixa realizado (por dia) no período. */
export async function cashFlow(params: { from: Date; to: Date; accountId?: string | null }) {
  const entries = await prisma.financialEntry.findMany({
    where: {
      status: "PAID",
      paidDate: { gte: params.from, lte: params.to },
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
    select: { direction: true, amountCents: true, paidDate: true },
    orderBy: { paidDate: "asc" },
  });

  let incomeCents = 0;
  let expenseCents = 0;
  const byDay = new Map<string, { incomeCents: number; expenseCents: number }>();
  for (const e of entries) {
    const key = (e.paidDate ?? new Date()).toISOString().slice(0, 10);
    const row = byDay.get(key) ?? { incomeCents: 0, expenseCents: 0 };
    if (e.direction === "INCOME") {
      row.incomeCents += e.amountCents;
      incomeCents += e.amountCents;
    } else {
      row.expenseCents += e.amountCents;
      expenseCents += e.amountCents;
    }
    byDay.set(key, row);
  }
  const days = [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v, netCents: v.incomeCents - v.expenseCents }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents, days };
}

/** DRE de caixa: receitas − despesas por categoria (lançamentos realizados). */
export async function dre(params: { from: Date; to: Date }) {
  const entries = await prisma.financialEntry.findMany({
    where: { status: "PAID", paidDate: { gte: params.from, lte: params.to } },
    select: { direction: true, amountCents: true, category: { select: { name: true } } },
  });
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  let incomeCents = 0;
  let expenseCents = 0;
  for (const e of entries) {
    const cat = e.category?.name ?? "Sem categoria";
    if (e.direction === "INCOME") {
      income.set(cat, (income.get(cat) ?? 0) + e.amountCents);
      incomeCents += e.amountCents;
    } else {
      expense.set(cat, (expense.get(cat) ?? 0) + e.amountCents);
      expenseCents += e.amountCents;
    }
  }
  const toRows = (m: Map<string, number>) =>
    [...m.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents);
  return {
    incomeCents,
    expenseCents,
    resultCents: incomeCents - expenseCents,
    income: toRows(income),
    expense: toRows(expense),
  };
}

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];

/** Margem bruta do período: receita de vendas − CMV (custo das mercadorias vendidas). */
export async function salesMargin(params: { from: Date; to: Date }) {
  const orders = await prisma.order.findMany({
    where: { status: { in: PAID_STATUSES }, paidAt: { gte: params.from, lte: params.to } },
    select: { totalCents: true, items: { select: { productId: true, variantId: true, quantity: true } } },
  });

  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);

  // custo atual do produto/variação (aproximação de CMV — snapshot de custo virá numa evolução)
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const o of orders)
    for (const it of o.items) {
      if (it.variantId) variantIds.add(it.variantId);
      else if (it.productId) productIds.add(it.productId);
    }

  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, costCents: true } }),
    prisma.productVariant.findMany({
      where: { id: { in: [...variantIds] } },
      select: { id: true, costCents: true, product: { select: { costCents: true } } },
    }),
  ]);
  const pCost = new Map(products.map((p) => [p.id, p.costCents ?? 0]));
  const vCost = new Map(variants.map((v) => [v.id, v.costCents ?? v.product.costCents ?? 0]));

  let cogsCents = 0;
  for (const o of orders)
    for (const it of o.items) {
      const unit = it.variantId ? vCost.get(it.variantId) ?? 0 : it.productId ? pCost.get(it.productId) ?? 0 : 0;
      cogsCents += unit * it.quantity;
    }

  return { revenueCents, cogsCents, grossProfitCents: revenueCents - cogsCents };
}
