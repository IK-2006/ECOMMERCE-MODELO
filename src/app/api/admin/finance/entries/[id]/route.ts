import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { financialSettleSchema } from "@/lib/validations";
import { settleEntry, cancelEntry } from "@/services/finance";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/finance/entries/[id] — liquida um lançamento pendente (PENDING → PAID). */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("finance.write");
  const { id } = await ctx.params;
  const body = financialSettleSchema.parse(await req.json());

  const entry = await settleEntry(id, { accountId: body.accountId, paidDate: body.paidDate ?? null });

  await audit({
    userId: admin.id,
    action: "finance.entry.settle",
    entity: "FinancialEntry",
    entityId: id,
    detail: { accountId: body.accountId },
    ip: getClientIp(req),
  });

  return NextResponse.json(entry);
});

/** DELETE /api/admin/finance/entries/[id] — cancela um lançamento. */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("finance.write");
  const { id } = await ctx.params;

  const entry = await cancelEntry(id);

  await audit({
    userId: admin.id,
    action: "finance.entry.cancel",
    entity: "FinancialEntry",
    entityId: id,
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true, entry });
});
