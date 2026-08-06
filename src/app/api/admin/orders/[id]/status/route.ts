import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { orderStatusUpdateSchema } from "@/lib/validations";
import { updateOrderStatus } from "@/services/orders";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/orders/[id]/status — atualiza status + rastreio */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("orders.write");
  const { id } = await ctx.params;
  const body = orderStatusUpdateSchema.parse(await req.json());

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Pedido não encontrado");

  const updated = await updateOrderStatus({
    orderId: id,
    status: body.status,
    note: body.note || `Atualizado pelo admin`,
    trackingCode: body.trackingCode || null,
  });

  await audit({
    userId: admin.id,
    action: "order.status_update",
    entity: "Order",
    entityId: id,
    detail: { from: order.status, to: body.status, trackingCode: body.trackingCode },
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true, status: updated.status });
});
