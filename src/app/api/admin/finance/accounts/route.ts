import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { financialAccountSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/finance/accounts — lista as contas financeiras. */
export const GET = handler(async () => {
  await requirePermission("finance.read");
  const accounts = await prisma.financialAccount.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(accounts);
});

/** POST /api/admin/finance/accounts — cria uma conta financeira. */
export const POST = handler(async (req) => {
  const admin = await requirePermission("finance.write");
  const body = financialAccountSchema.parse(await req.json());
  const account = await prisma.financialAccount.create({
    data: { name: body.name, kind: body.kind, active: body.active },
  });
  await audit({
    userId: admin.id,
    action: "finance.account.create",
    entity: "FinancialAccount",
    entityId: account.id,
    detail: { name: account.name, kind: account.kind },
    ip: getClientIp(req),
  });
  return NextResponse.json(account, { status: 201 });
});
