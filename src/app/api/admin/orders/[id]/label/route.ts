import { NextResponse } from "next/server";
import { handler, ApiError, tooMany } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { generateLabelForOrder } from "@/services/shipping/labels";

/**
 * POST /api/admin/orders/[id]/label
 * Gera (ou reprocessa) a etiqueta do pedido no Melhor Envio, salva o
 * rastreio/PDF e marca o pedido como ENVIADO (notifica o cliente).
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("orders.write");
  const { id } = await ctx.params;
  if (!id) throw new ApiError(400, "Pedido inválido");

  // trava emissão em rajada (evita clique duplo / cobrança acidental de saldo)
  const limit = rateLimit(`label:${admin.id}`, 20, 5 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  try {
    const result = await generateLabelForOrder(id);
    await audit({
      userId: admin.id,
      action: "shipping.label_generate",
      entity: "Order",
      entityId: id,
      detail: { trackingCode: result.trackingCode, company: result.company },
      ip: getClientIp(req),
    });
    return NextResponse.json({
      ok: true,
      trackingCode: result.trackingCode,
      labelUrl: result.labelUrl,
      company: result.company,
    });
  } catch (err) {
    // registra a falha (o serviço já persistiu shippingError no pedido)
    await audit({
      userId: admin.id,
      action: "shipping.label_generate_error",
      entity: "Order",
      entityId: id,
      detail: { error: err instanceof Error ? err.message : String(err) },
      ip: getClientIp(req),
    });
    throw err;
  }
});
