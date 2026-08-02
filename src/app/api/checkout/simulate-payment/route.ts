import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { updateOrderStatus } from "@/services/orders";
import { isMercadoPagoConfigured } from "@/services/payments/mercadopago";

const simulateSchema = z.object({
  orderId: z.string().cuid(),
  action: z.enum(["approve", "reject"]),
});

/**
 * POST /api/checkout/simulate-payment — SOMENTE quando o Mercado Pago
 * NÃO está configurado. Simula o resultado do pagamento para permitir
 * testar o fluxo completo em desenvolvimento.
 */
export const POST = handler(async (req) => {
  if (isMercadoPagoConfigured()) {
    throw new ApiError(404, "Indisponível: pagamentos reais estão configurados");
  }

  const user = await requireUser();
  const { orderId, action } = simulateSchema.parse(await req.json());

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
  });
  if (!order) throw new ApiError(404, "Pedido não encontrado");
  if (order.status !== "AGUARDANDO_PAGAMENTO") {
    throw new ApiError(409, "Este pedido não está aguardando pagamento");
  }

  await updateOrderStatus({
    orderId,
    status: action === "approve" ? "PAGO" : "CANCELADO",
    note:
      action === "approve"
        ? "Pagamento aprovado (gateway simulado)"
        : "Pagamento recusado (gateway simulado)",
    paymentInfo: {
      mpPaymentId: `SIM-${Date.now()}`,
      paymentMethod: "simulado",
    },
  });

  return NextResponse.json({ ok: true });
});
