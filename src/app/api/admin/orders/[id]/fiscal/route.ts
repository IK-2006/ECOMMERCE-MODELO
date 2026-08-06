import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { fiscalEmitSchema } from "@/lib/validations";
import { emitFiscalInvoice } from "@/services/fiscal";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** POST /api/admin/orders/[id]/fiscal — emite (ou reenvia) uma nota fiscal do pedido. */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("fiscal.manage");
  const { id } = await ctx.params;
  const { type } = fiscalEmitSchema.parse(await req.json());

  const invoice = await emitFiscalInvoice({ orderId: id, type });

  await audit({
    userId: admin.id,
    action: "fiscal.emit",
    entity: "FiscalInvoice",
    entityId: invoice.id,
    detail: { type, status: invoice.status },
    ip: getClientIp(req),
  });

  return NextResponse.json(invoice);
});
