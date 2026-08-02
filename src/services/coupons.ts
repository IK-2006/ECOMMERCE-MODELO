import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";

export interface CouponResult {
  couponId: string;
  code: string;
  type: string;
  discountCents: number; // desconto sobre o subtotal (FREE_SHIPPING = 0 aqui)
  freeShipping: boolean;
  maxUses: number | null; // limite global — usado para incremento atômico no pedido
}

/**
 * Valida um cupom para o usuário/subtotal e calcula o desconto.
 * Lança ApiError(400) com mensagem amigável quando inválido.
 */
export async function validateCoupon(
  code: string,
  userId: string | null,
  subtotalCents: number
): Promise<CouponResult> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase().trim() },
  });

  if (!coupon || !coupon.active) throw new ApiError(400, "Cupom inválido");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now)
    throw new ApiError(400, "Este cupom ainda não está ativo");
  if (coupon.expiresAt && coupon.expiresAt < now)
    throw new ApiError(400, "Este cupom expirou");
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
    throw new ApiError(400, "Este cupom atingiu o limite de usos");
  if (coupon.minOrderCents != null && subtotalCents < coupon.minOrderCents)
    throw new ApiError(
      400,
      `Este cupom exige pedido mínimo de R$ ${(coupon.minOrderCents / 100).toFixed(2).replace(".", ",")}`
    );

  if (coupon.perUserLimit != null && userId) {
    const uses = await prisma.order.count({
      where: { userId, couponId: coupon.id, status: { notIn: ["CANCELADO"] } },
    });
    if (uses >= coupon.perUserLimit)
      throw new ApiError(400, "Você já utilizou este cupom");
  }

  let discountCents = 0;
  if (coupon.type === "PERCENT" && coupon.percent) {
    discountCents = Math.floor((subtotalCents * coupon.percent) / 100);
  } else if (coupon.type === "FIXED" && coupon.valueCents) {
    discountCents = Math.min(coupon.valueCents, subtotalCents);
  }

  return {
    couponId: coupon.id,
    code: coupon.code,
    type: coupon.type,
    discountCents,
    freeShipping: coupon.type === "FREE_SHIPPING",
    maxUses: coupon.maxUses,
  };
}
