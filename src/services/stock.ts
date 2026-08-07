import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { postPurchasePayable } from "@/services/finance";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const STOCK_REASONS: Record<string, string> = {
  INITIAL: "Estoque inicial",
  RESTOCK: "Entrada / reposição",
  PURCHASE: "Entrada de compra",
  ADJUST: "Ajuste manual",
  CORRECTION: "Correção de inventário",
  SALE: "Venda",
  CANCEL_RESTORE: "Devolução (pedido cancelado)",
};

/** Registra uma movimentação de estoque (usar dentro de uma transação). */
export async function recordMovement(
  tx: Tx,
  params: {
    productId: string;
    variantId?: string | null;
    delta: number;
    resulting: number;
    reason: string;
    note?: string | null;
    userId?: string | null;
    orderId?: string | null;
  }
) {
  await tx.stockMovement.create({
    data: {
      productId: params.productId,
      variantId: params.variantId ?? null,
      delta: params.delta,
      resulting: params.resulting,
      reason: params.reason,
      note: params.note ?? null,
      userId: params.userId ?? null,
      orderId: params.orderId ?? null,
    },
  });
}

/**
 * Define o estoque (valor absoluto) de um produto ou variação e registra
 * o movimento correspondente. Retorna o antes/depois.
 */
export async function setStock(params: {
  productId: string;
  variantId?: string | null;
  newStock: number;
  reason?: string;
  note?: string | null;
  userId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    let oldStock: number;
    if (params.variantId) {
      const v = await tx.productVariant.findUnique({
        where: { id: params.variantId },
        select: { stock: true, productId: true },
      });
      if (!v || v.productId !== params.productId)
        throw new ApiError(404, "Variação não encontrada");
      oldStock = v.stock;
      await tx.productVariant.update({
        where: { id: params.variantId },
        data: { stock: params.newStock },
      });
    } else {
      const p = await tx.product.findUnique({
        where: { id: params.productId },
        select: { stock: true },
      });
      if (!p) throw new ApiError(404, "Produto não encontrado");
      oldStock = p.stock;
      await tx.product.update({
        where: { id: params.productId },
        data: { stock: params.newStock },
      });
    }

    const delta = params.newStock - oldStock;
    if (delta !== 0) {
      await recordMovement(tx, {
        productId: params.productId,
        variantId: params.variantId ?? null,
        delta,
        resulting: params.newStock,
        reason: params.reason ?? "ADJUST",
        note: params.note ?? null,
        userId: params.userId ?? null,
      });
    }
    return { oldStock, newStock: params.newStock, delta };
  });
}

export interface StockEntryItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  costCents?: number | null;
}

/**
 * Custo médio ponderado: novo custo = (estoque×custoAtual + qtd×custoNovo) / (estoque+qtd).
 * Sem custo anterior ou estoque zerado → assume o custo novo (começa a valorizar a partir daqui).
 */
export function weightedAvgCost(
  oldStock: number,
  oldCost: number | null,
  qty: number,
  newCost: number
): number {
  if (oldCost == null || oldStock <= 0) return newCost;
  const total = oldStock + qty;
  if (total <= 0) return newCost;
  return Math.round((oldStock * oldCost + qty * newCost) / total);
}

/**
 * Entrada de mercadoria (compra): SOMA ao estoque de cada item, registra
 * o movimento PURCHASE (com custo + fornecedor) e atualiza o custo do
 * produto/variação quando informado. Tudo numa transação.
 */
export interface StockEntryParams {
  adminId: string;
  supplierId?: string | null;
  note?: string | null;
  items: StockEntryItem[];
}

/**
 * Entrada de mercadoria COMPONÍVEL — executa dentro de uma transação já aberta.
 * Reaproveitada pelo recebimento de Ordem de Compra (Fase 3) sem aninhar transação.
 */
export async function createStockEntryTx(tx: Tx, params: StockEntryParams) {
  if (params.items.length === 0) throw new ApiError(400, "Adicione ao menos um item.");
  const supplierId = params.supplierId || null;

  const results: Array<{ productId: string; variantId: string | null; added: number; resulting: number }> = [];

    for (const it of params.items) {
      const hasCost = it.costCents != null && it.costCents >= 0;
      let resulting = 0;

      if (it.variantId) {
        const v = await tx.productVariant.findUnique({
          where: { id: it.variantId },
          select: { stock: true, productId: true, costCents: true },
        });
        if (!v || v.productId !== it.productId)
          throw new ApiError(404, "Variação não encontrada");
        // custo médio ponderado (não sobrescreve com o último custo)
        const costUpdate = hasCost
          ? { costCents: weightedAvgCost(v.stock, v.costCents, it.quantity, it.costCents!) }
          : {};
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: { stock: { increment: it.quantity }, ...costUpdate },
        });
        resulting = v.stock + it.quantity;
      } else {
        const p = await tx.product.findUnique({
          where: { id: it.productId },
          select: { stock: true, costCents: true },
        });
        if (!p) throw new ApiError(404, "Produto não encontrado");
        const costUpdate = hasCost
          ? { costCents: weightedAvgCost(p.stock, p.costCents, it.quantity, it.costCents!) }
          : {};
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity }, ...costUpdate },
        });
        resulting = p.stock + it.quantity;
      }

      await tx.stockMovement.create({
        data: {
          productId: it.productId,
          variantId: it.variantId ?? null,
          delta: it.quantity,
          resulting,
          reason: "PURCHASE",
          note: params.note ?? null,
          costCents: hasCost ? it.costCents : null,
          supplierId,
          userId: params.adminId,
        },
      });

      results.push({ productId: it.productId, variantId: it.variantId ?? null, added: it.quantity, resulting });
    }

    // financeiro: gera a conta a pagar (pendente) da compra, se houver custo total
    const totalCostCents = params.items.reduce(
      (s, it) => s + (it.costCents && it.costCents > 0 ? it.costCents * it.quantity : 0),
      0
    );
    if (totalCostCents > 0) {
      const n = params.items.length;
      await postPurchasePayable(tx, {
        supplierId,
        amountCents: totalCostCents,
        description: `Compra — entrada de mercadoria (${n} ${n === 1 ? "item" : "itens"})`,
        createdById: params.adminId,
      });
    }

    return results;
}

/** Entrada de mercadoria (compra) — abre a própria transação. */
export async function createStockEntry(params: StockEntryParams) {
  return prisma.$transaction((tx) => createStockEntryTx(tx, params));
}

// ------------------------- Estoque avançado (Fase 4) -------------------------

// Nível mínimo padrão quando o produto não define um (mantém o alerta ≤5 histórico).
export const DEFAULT_MIN_STOCK = 5;

export interface InventoryCount {
  productId: string;
  variantId?: string | null;
  countedStock: number;
}

/**
 * Inventário / balanço: define o estoque CONTADO de cada item e registra a
 * diferença como movimento CORRECTION. Só ajusta o que mudou. Uma transação.
 */
export async function applyInventory(params: { adminId: string; counts: InventoryCount[] }) {
  return prisma.$transaction(async (tx) => {
    let adjusted = 0;
    for (const c of params.counts) {
      if (c.countedStock < 0) continue;
      let oldStock: number;
      if (c.variantId) {
        const v = await tx.productVariant.findUnique({
          where: { id: c.variantId },
          select: { stock: true, productId: true },
        });
        if (!v || v.productId !== c.productId) continue;
        oldStock = v.stock;
        if (oldStock === c.countedStock) continue;
        await tx.productVariant.update({ where: { id: c.variantId }, data: { stock: c.countedStock } });
      } else {
        const p = await tx.product.findUnique({ where: { id: c.productId }, select: { stock: true } });
        if (!p) continue;
        oldStock = p.stock;
        if (oldStock === c.countedStock) continue;
        await tx.product.update({ where: { id: c.productId }, data: { stock: c.countedStock } });
      }
      await recordMovement(tx, {
        productId: c.productId,
        variantId: c.variantId ?? null,
        delta: c.countedStock - oldStock,
        resulting: c.countedStock,
        reason: "CORRECTION",
        note: "Inventário / balanço",
        userId: params.adminId,
      });
      adjusted++;
    }
    return { adjusted };
  });
}

export interface LowStockItem {
  productId: string;
  variantId: string | null;
  name: string;
  stock: number;
  min: number;
}

/** Itens (produto ou variação) no nível mínimo ou abaixo — para alertas de reposição. */
export async function lowStockItems(): Promise<LowStockItem[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { variants: { where: { active: true }, orderBy: { name: "asc" } } },
  });
  const items: LowStockItem[] = [];
  for (const p of products) {
    const min = p.minStock ?? DEFAULT_MIN_STOCK;
    if (p.variants.length > 0) {
      for (const v of p.variants) {
        if (v.stock <= min) items.push({ productId: p.id, variantId: v.id, name: `${p.name} · ${v.name}`, stock: v.stock, min });
      }
    } else if (p.stock <= min) {
      items.push({ productId: p.id, variantId: null, name: p.name, stock: p.stock, min });
    }
  }
  return items;
}
