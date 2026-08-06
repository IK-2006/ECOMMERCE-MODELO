import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { createStockEntryTx } from "@/services/stock";

// ---------------------------------------------------------------
// Compras — Ordem de Compra (Fase 3). Rascunho → enviada →
// recebimento parcial/total. O recebimento REAPROVEITA o motor de
// entrada de estoque (createStockEntryTx): estoque + custo + conta a
// pagar (Fase 2), tudo na mesma transação. A OC só adiciona o workflow.
// ---------------------------------------------------------------

function generatePONumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OC-${year}-${rand}`;
}

export const PO_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  RECEBIDA_PARCIAL: "Recebida (parcial)",
  RECEBIDA: "Recebida",
  CANCELADA: "Cancelada",
};

export interface POItemInput {
  productId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  unitCostCents: number;
}

/** Cria a OC em RASCUNHO. */
export async function createPurchaseOrder(params: {
  supplierId?: string | null;
  notes?: string | null;
  expectedAt?: Date | null;
  items: POItemInput[];
  adminId: string;
}) {
  if (params.items.length === 0) throw new ApiError(400, "Adicione ao menos um item.");
  const totalCents = params.items.reduce((s, i) => s + i.unitCostCents * i.quantity, 0);

  return prisma.purchaseOrder.create({
    data: {
      number: generatePONumber(),
      supplierId: params.supplierId || null,
      notes: params.notes || null,
      expectedAt: params.expectedAt ?? null,
      totalCents,
      createdById: params.adminId,
      items: {
        create: params.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? null,
          name: i.name,
          quantity: i.quantity,
          unitCostCents: i.unitCostCents,
        })),
      },
    },
    include: { items: true },
  });
}

/** RASCUNHO → ENVIADA. */
export async function sendPurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new ApiError(404, "Ordem de compra não encontrada");
  if (po.status !== "RASCUNHO") throw new ApiError(409, "Só é possível enviar uma OC em rascunho.");
  return prisma.purchaseOrder.update({ where: { id }, data: { status: "ENVIADA" } });
}

/** Cancela a OC (não permitido se já totalmente recebida). Não mexe no estoque já recebido. */
export async function cancelPurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new ApiError(404, "Ordem de compra não encontrada");
  if (po.status === "RECEBIDA") throw new ApiError(409, "OC já recebida não pode ser cancelada.");
  if (po.status === "CANCELADA") return po;
  return prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELADA" } });
}

export interface ReceiveLine {
  itemId: string;
  qty: number;
  unitCostCents?: number | null;
}

/**
 * Recebimento (parcial ou total). Dá entrada no estoque via createStockEntryTx
 * (que gera a conta a pagar), atualiza o recebido por item e recalcula o status.
 */
export async function receivePurchaseOrder(params: { id: string; adminId: string; lines: ReceiveLine[] }) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: params.id }, include: { items: true } });
    if (!po) throw new ApiError(404, "Ordem de compra não encontrada");
    if (po.status === "CANCELADA") throw new ApiError(409, "OC cancelada.");
    if (po.status === "RECEBIDA") throw new ApiError(409, "OC já totalmente recebida.");

    const byId = new Map(po.items.map((i) => [i.id, i]));
    const toReceive: Array<{ itemId: string; productId: string; variantId: string | null; qty: number; costCents: number }> = [];

    for (const line of params.lines) {
      if (line.qty <= 0) continue;
      const item = byId.get(line.itemId);
      if (!item) throw new ApiError(400, "Item da OC inválido.");
      const pending = item.quantity - item.receivedQty;
      if (line.qty > pending)
        throw new ApiError(400, `Recebimento maior que o pendente para "${item.name}".`);
      const costCents =
        line.unitCostCents != null && line.unitCostCents >= 0 ? line.unitCostCents : item.unitCostCents;
      toReceive.push({ itemId: item.id, productId: item.productId, variantId: item.variantId, qty: line.qty, costCents });
    }

    if (toReceive.length === 0) throw new ApiError(400, "Informe as quantidades recebidas.");

    // reaproveita o motor de entrada: estoque + custo + conta a pagar (Fase 2)
    await createStockEntryTx(tx, {
      adminId: params.adminId,
      supplierId: po.supplierId,
      note: `Recebimento OC ${po.number}`,
      items: toReceive.map((r) => ({ productId: r.productId, variantId: r.variantId, quantity: r.qty, costCents: r.costCents })),
    });

    for (const r of toReceive) {
      await tx.purchaseOrderItem.update({
        where: { id: r.itemId },
        data: { receivedQty: { increment: r.qty } },
      });
    }

    const fresh = await tx.purchaseOrder.findUnique({ where: { id: params.id }, include: { items: true } });
    const allReceived = fresh!.items.every((i) => i.receivedQty >= i.quantity);
    return tx.purchaseOrder.update({
      where: { id: params.id },
      data: { status: allReceived ? "RECEBIDA" : "RECEBIDA_PARCIAL" },
    });
  });
}
