import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { refundRequestSchema } from "@/lib/validations";
import { createRefundRequest } from "@/services/refunds";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { tooMany } from "@/lib/api-helpers";

/** POST /api/account/refunds — cliente solicita reembolso de um pedido dele */
export const POST = handler(async (req) => {
  const user = await requireUser();

  const rl = rateLimit(`refund:${user.id}:${getClientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSeconds);

  const body = refundRequestSchema.parse(await req.json());
  const request = await createRefundRequest({
    userId: user.id,
    orderId: body.orderId,
    reason: body.reason,
    description: body.description,
  });

  return NextResponse.json({ id: request.id, status: request.status }, { status: 201 });
});
