import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { financialCategorySchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/finance/categories — lista as categorias (plano de contas). */
export const GET = handler(async () => {
  await requirePermission("finance.read");
  const categories = await prisma.financialCategory.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(categories);
});

/** POST /api/admin/finance/categories — cria uma categoria. */
export const POST = handler(async (req) => {
  const admin = await requirePermission("finance.write");
  const body = financialCategorySchema.parse(await req.json());
  const category = await prisma.financialCategory.create({
    data: { name: body.name, type: body.type, active: body.active },
  });
  await audit({
    userId: admin.id,
    action: "finance.category.create",
    entity: "FinancialCategory",
    entityId: category.id,
    detail: { name: category.name, type: category.type },
    ip: getClientIp(req),
  });
  return NextResponse.json(category, { status: 201 });
});
