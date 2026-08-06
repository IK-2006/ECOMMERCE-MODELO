import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { couponSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("coupons.write");
  const { id } = await ctx.params;
  const body = couponSchema.parse(await req.json());

  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Cupom não encontrado");

  const codeTaken = await prisma.coupon.findFirst({
    where: { code: body.code, id: { not: id } },
  });
  if (codeTaken) throw new ApiError(409, "Já existe um cupom com este código");

  const coupon = await prisma.coupon.update({
    where: { id },
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
    action: "coupon.update",
    entity: "Coupon",
    entityId: id,
    detail: { code: coupon.code },
    ip: getClientIp(req),
  });

  return NextResponse.json(coupon);
});

export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("coupons.write");
  const { id } = await ctx.params;

  const used = await prisma.order.count({ where: { couponId: id } });
  if (used > 0) {
    // cupom já usado em pedidos: apenas desativa (preserva histórico)
    await prisma.coupon.update({ where: { id }, data: { active: false } });
    await audit({ userId: admin.id, action: "coupon.deactivate", entity: "Coupon", entityId: id, ip: getClientIp(req) });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.coupon.delete({ where: { id } });
  await audit({ userId: admin.id, action: "coupon.delete", entity: "Coupon", entityId: id, ip: getClientIp(req) });
  return NextResponse.json({ ok: true });
});
