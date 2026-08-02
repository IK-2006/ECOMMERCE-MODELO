import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/session";
import { shippingRuleSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const body = shippingRuleSchema.parse(await req.json());

  const rule = await prisma.shippingRule.create({
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
    action: "shipping_rule.create",
    entity: "ShippingRule",
    entityId: rule.id,
    detail: { name: rule.name },
    ip: getClientIp(req),
  });

  return NextResponse.json(rule, { status: 201 });
});
