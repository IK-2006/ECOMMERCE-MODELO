import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { updateOrderStatus } from "@/services/orders";
import { storeConfig } from "@/lib/store-config";
import {
  REFUNDABLE_ORDER_STATUSES,
  OPEN_REFUND_STATUSES,
  REFUND_REASON_LABELS,
  REFUND_STATUS_LABELS,
} from "@/lib/utils";
import {
  sendRefundRequestReceived,
  sendRefundStatusUpdate,
} from "@/lib/email";

// ---------------------------------------------------------------
// Reembolso / devolução solicitado pelo CLIENTE.
//   1. Cliente abre a solicitação (motivo + descrição).
//   2. Admin analisa: EM_ANALISE / APROVADO / RECUSADO.
//   3. Ao concluir (CONCLUIDO), o pedido vira REEMBOLSADO (devolve
//      estoque) — o estorno do dinheiro é feito no painel do Mercado
//      Pago (o webhook também marca REEMBOLSADO automaticamente).
// ---------------------------------------------------------------

/** Cliente abre uma solicitação de reembolso para um pedido dele. */
export async function createRefundRequest(params: {
  userId: string;
  orderId: string;
  reason: string;
  description: string;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, userId: params.userId },
    include: { refundRequests: true },
  });
  if (!order) throw new ApiError(404, "Pedido não encontrado.");

  if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(
      400,
      "Este pedido não está elegível para reembolso no momento."
    );
  }

  const hasOpen = order.refundRequests.some((r) =>
    OPEN_REFUND_STATUSES.includes(r.status)
  );
  if (hasOpen) {
    throw new ApiError(409, "Já existe uma solicitação de reembolso para este pedido.");
  }

  const request = await prisma.refundRequest.create({
    data: {
      orderId: order.id,
      userId: params.userId,
      reason: params.reason,
      description: params.description,
      status: "SOLICITADO",
    },
  });

  // avisa a loja (não bloqueante)
  const customer = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { name: true },
  });
  void sendRefundRequestReceived({
    to: storeConfig.contactEmail,
    orderNumber: order.number,
    customerName: customer?.name ?? "Cliente",
    reasonLabel: REFUND_REASON_LABELS[params.reason] ?? params.reason,
  });

  return request;
}

/** Admin resolve a solicitação (analisar / aprovar / recusar / concluir). */
export async function resolveRefundRequest(params: {
  id: string;
  status: string;
  adminNote?: string | null;
}) {
  const request = await prisma.refundRequest.findUnique({
    where: { id: params.id },
    include: { order: true, user: { select: { name: true, email: true } } },
  });
  if (!request) throw new ApiError(404, "Solicitação não encontrada.");

  const terminal = params.status === "RECUSADO" || params.status === "CONCLUIDO";

  const updated = await prisma.refundRequest.update({
    where: { id: params.id },
    data: {
      status: params.status,
      adminNote: params.adminNote || null,
      resolvedAt: terminal ? new Date() : null,
    },
  });

  // Ao concluir, marca o pedido como REEMBOLSADO (devolve estoque/cupom).
  // Idempotente: se já estiver reembolsado, não duplica efeitos.
  if (params.status === "CONCLUIDO") {
    await updateOrderStatus({
      orderId: request.orderId,
      status: "REEMBOLSADO",
      note: `Reembolso concluído (solicitação ${request.id.slice(-6)})`,
    });
  }

  // notifica o cliente
  void sendRefundStatusUpdate({
    to: request.user.email,
    customerName: request.user.name,
    orderNumber: request.order.number,
    statusLabel: REFUND_STATUS_LABELS[params.status] ?? params.status,
    adminNote: params.adminNote || null,
  });

  return updated;
}
