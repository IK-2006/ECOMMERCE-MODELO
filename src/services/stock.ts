import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const STOCK_REASONS: Record<string, string> = {
  INITIAL: "Estoque inicial",
  RESTOCK: "Entrada / reposição",
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
