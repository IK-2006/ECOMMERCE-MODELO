import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { stockEntrySchema } from "@/lib/validations";
import { createStockEntry } from "@/services/stock";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** POST /api/admin/stock/entry — entrada de mercadoria (compra) */
export const POST = handler(async (req) => {
  const admin = await requirePermission("stock.write");
  const body = stockEntrySchema.parse(await req.json());

  const results = await createStockEntry({
    adminId: admin.id,
    supplierId: body.supplierId || null,
    note: body.note || null,
    items: body.items,
  });

  await audit({
    userId: admin.id,
    action: "stock.entry",
    entity: "StockMovement",
    detail: { items: results.length, supplierId: body.supplierId || null },
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true, items: results }, { status: 201 });
});
