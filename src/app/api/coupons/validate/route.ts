import { NextResponse } from "next/server";
import { handler, ApiError, tooMany } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/session";
import { getCartDetailed } from "@/lib/cart";
import { couponValidateSchema } from "@/lib/validations";
import { validateCoupon } from "@/services/coupons";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/** POST /api/coupons/validate — valida cupom contra o carrinho atual */
export const POST = handler(async (req) => {
  // limita tentativas → impede enumeração/força-bruta de códigos de cupom
  const limit = rateLimit(`coupon:${getClientIp(req)}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const { code } = couponValidateSchema.parse(await req.json());
  const user = await getCurrentUser();

  const cart = await getCartDetailed();
  if (!cart || cart.items.length === 0) throw new ApiError(400, "Carrinho vazio");

  const result = await validateCoupon(code, user?.id ?? null, cart.subtotalCents);
  return NextResponse.json({
    code: result.code,
    discountCents: result.discountCents,
    freeShipping: result.freeShipping,
  });
});
