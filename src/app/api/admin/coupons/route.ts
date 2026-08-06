import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { couponSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const admin = await requirePermission("coupons.write");
  const body = couponSchema.parse(await req.json());

  const existing = await prisma.coupon.findUnique({ where: { code: body.code } });
  if (existing) throw new ApiError(409, "Já existe um cupom com este código");

  const coupon = await prisma.coupon.create({
    data: {
      code: body.code,
      description: body.description || null,
      type: body.type,
      percent: body.type === "PERCENT" ? body.percent : null,
      valueCents: body.type === "FIXED" ? body.valueCents : null,
      minOrderCents: body.minOrderCents ?? null,
      maxUses: body.maxUses ?? null,
      perUserLimit: body.perUserLimit ?? null,
      startsAt: body.startsAt ?? null,
      expiresAt: body.expiresAt ?? null,
      active: body.active,
    },
  });

  await audit({
    userId: admin.id,
    action: "coupon.create",
    entity: "Coupon",
    entityId: coupon.id,
    detail: { code: coupon.code },
    ip: getClientIp(req),
  });

  return NextResponse.json(coupon, { status: 201 });
});
