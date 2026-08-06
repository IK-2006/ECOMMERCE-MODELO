import { NextResponse } from "next/server";
import { handler, ApiError, tooMany } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { refreshTracking } from "@/services/shipping/labels";

/**
 * POST /api/admin/orders/[id]/tracking
 * Consulta o rastreio atual no Melhor Envio e atualiza o pedido.
 * Se a entrega for confirmada, marca ENTREGUE (notifica o cliente).
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("orders.write");
  const { id } = await ctx.params;
  if (!id) throw new ApiError(400, "Pedido inválido");

  const limit = rateLimit(`tracking:${admin.id}`, 60, 5 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const result = await refreshTracking(id);

  await audit({
    userId: admin.id,
    action: "shipping.tracking_refresh",
    entity: "Order",
    entityId: id,
    detail: { status: result.status, delivered: result.delivered },
    ip: getClientIp(req),
  });

  return NextResponse.json({
    ok: true,
    status: result.status,
    trackingCode: result.trackingCode,
    delivered: result.delivered,
  });
});
