import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { purchaseReceiveSchema } from "@/lib/validations";
import { receivePurchaseOrder } from "@/services/purchases";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** POST /api/admin/purchases/[id]/receive — recebimento parcial ou total. */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("purchases.write");
  const { id } = await ctx.params;
  const body = purchaseReceiveSchema.parse(await req.json());

  const po = await receivePurchaseOrder({
    id,
    adminId: admin.id,
    lines: body.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unitCostCents: l.unitCostCents ?? null })),
  });

  await audit({
    userId: admin.id,
    action: "purchase.receive",
    entity: "PurchaseOrder",
    entityId: id,
    detail: { lines: body.lines.length, status: po.status },
    ip: getClientIp(req),
  });

  return NextResponse.json(po);
});
