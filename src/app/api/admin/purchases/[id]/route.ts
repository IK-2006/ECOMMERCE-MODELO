import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { purchaseActionSchema } from "@/lib/validations";
import { sendPurchaseOrder, cancelPurchaseOrder } from "@/services/purchases";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/purchases/[id] — detalhe da OC. */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("purchases.read");
  const { id } = await ctx.params;
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!po) throw new ApiError(404, "Ordem de compra não encontrada");
  return NextResponse.json(po);
});

/** PATCH /api/admin/purchases/[id] — envia ou cancela a OC. */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("purchases.write");
  const { id } = await ctx.params;
  const { action } = purchaseActionSchema.parse(await req.json());

  const po = action === "send" ? await sendPurchaseOrder(id) : await cancelPurchaseOrder(id);

  await audit({
    userId: admin.id,
    action: action === "send" ? "purchase.send" : "purchase.cancel",
    entity: "PurchaseOrder",
    entityId: id,
    ip: getClientIp(req),
  });

  return NextResponse.json(po);
});
