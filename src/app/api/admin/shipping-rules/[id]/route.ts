import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { shippingRuleSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("shipping.manage");
  const { id } = await ctx.params;
  const body = shippingRuleSchema.parse(await req.json());

  const existing = await prisma.shippingRule.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Regra não encontrada");

  const rule = await prisma.shippingRule.update({
    where: { id },
    data: {
      name: body.name,
      service: body.service,
      cepStart: body.cepStart,
      cepEnd: body.cepEnd,
      minWeightGrams: body.minWeightGrams,
      maxWeightGrams: body.maxWeightGrams,
      priceCents: body.priceCents,
      days: body.days,
      active: body.active,
    },
  });

  await audit({
    userId: admin.id,
    action: "shipping_rule.update",
    entity: "ShippingRule",
    entityId: id,
    ip: getClientIp(req),
  });

  return NextResponse.json(rule);
});

export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("shipping.manage");
  const { id } = await ctx.params;
  await prisma.shippingRule.delete({ where: { id } }).catch(() => {
    throw new ApiError(404, "Regra não encontrada");
  });
  await audit({
    userId: admin.id,
    action: "shipping_rule.delete",
    entity: "ShippingRule",
    entityId: id,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
