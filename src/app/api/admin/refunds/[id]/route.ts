import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/session";
import { refundResolveSchema } from "@/lib/validations";
import { resolveRefundRequest } from "@/services/refunds";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/refunds/[id] — admin analisa/aprova/recusa/conclui */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = refundResolveSchema.parse(await req.json());

  const updated = await resolveRefundRequest({
    id,
    status: body.status,
    adminNote: body.adminNote,
  });

  await audit({
    userId: admin.id,
    action: "refund.resolve",
    entity: "RefundRequest",
    entityId: id,
    detail: { status: body.status },
    ip: getClientIp(req),
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
});
