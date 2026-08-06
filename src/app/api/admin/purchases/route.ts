import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { purchaseOrderSchema } from "@/lib/validations";
import { createPurchaseOrder } from "@/services/purchases";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/purchases — lista as ordens de compra. */
export const GET = handler(async () => {
  await requirePermission("purchases.read");
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      number: true,
      status: true,
      supplierId: true,
      totalCents: true,
      expectedAt: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  return NextResponse.json(orders);
});

/** POST /api/admin/purchases — cria uma OC em rascunho. */
export const POST = handler(async (req) => {
  const admin = await requirePermission("purchases.write");
  const body = purchaseOrderSchema.parse(await req.json());

  const po = await createPurchaseOrder({
    supplierId: body.supplierId || null,
    notes: body.notes || null,
    expectedAt: body.expectedAt ?? null,
    items: body.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? null,
      name: i.name,
      quantity: i.quantity,
      unitCostCents: i.unitCostCents,
    })),
    adminId: admin.id,
  });

  await audit({
    userId: admin.id,
    action: "purchase.create",
    entity: "PurchaseOrder",
    entityId: po.id,
    detail: { number: po.number, items: po.items.length, totalCents: po.totalCents },
    ip: getClientIp(req),
  });

  return NextResponse.json(po, { status: 201 });
});
