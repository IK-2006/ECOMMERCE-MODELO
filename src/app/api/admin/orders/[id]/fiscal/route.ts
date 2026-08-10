import { NextResponse } from "next/server";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { fiscalEmitSchema } from "@/lib/validations";
import { emitFiscalInvoice, refreshFiscalInvoice, invoicesForOrder } from "@/services/fiscal";
import { prisma } from "@/lib/prisma";
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

/**
 * PATCH /api/admin/orders/[id]/fiscal — consulta o provedor e atualiza o
 * status das notas do pedido (polling da autorização assíncrona da SEFAZ).
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("fiscal.manage");
  const { id } = await ctx.params;
  const { invoiceId } = (await req.json().catch(() => ({}))) as { invoiceId?: string };

  if (invoiceId) {
    const inv = await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv || inv.orderId !== id) throw new ApiError(404, "Nota não encontrada");
    return NextResponse.json(await refreshFiscalInvoice(invoiceId));
  }

  // sem invoiceId: atualiza todas as notas em processamento do pedido
  const invoices = await invoicesForOrder(id);
  const updated = await Promise.all(
    invoices.map((inv) => (inv.status === "PROCESSANDO" ? refreshFiscalInvoice(inv.id) : inv))
  );
  return NextResponse.json(updated);
});
