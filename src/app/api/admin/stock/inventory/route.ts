import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { inventorySchema } from "@/lib/validations";
import { applyInventory } from "@/services/stock";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** POST /api/admin/stock/inventory — aplica um inventário/balanço (ajuste em lote). */
export const POST = handler(async (req) => {
  const admin = await requirePermission("stock.write");
  const body = inventorySchema.parse(await req.json());

  const result = await applyInventory({
    adminId: admin.id,
    counts: body.counts.map((c) => ({
      productId: c.productId,
      variantId: c.variantId ?? null,
      countedStock: c.countedStock,
    })),
  });

  await audit({
    userId: admin.id,
    action: "stock.inventory",
    entity: "Product",
    detail: { items: body.counts.length, adjusted: result.adjusted },
    ip: getClientIp(req),
  });

  return NextResponse.json(result);
});
