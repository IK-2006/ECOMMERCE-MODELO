import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { financialEntrySchema } from "@/lib/validations";
import { createEntry } from "@/services/finance";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/finance/entries?direction=&status=&from=&to= — lista lançamentos. */
export const GET = handler(async (req) => {
  await requirePermission("finance.read");
  const url = new URL(req.url);
  const direction = url.searchParams.get("direction");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Prisma.FinancialEntryWhereInput = {};
  if (direction === "INCOME" || direction === "EXPENSE") where.direction = direction;
  if (status === "PENDING" || status === "PAID" || status === "CANCELED") where.status = status;
  if (from || to) {
    const gte = from ? new Date(`${from}T00:00:00`) : undefined;
    const lte = to ? new Date(`${to}T23:59:59.999`) : undefined;
    where.createdAt = { ...(gte && { gte }), ...(lte && { lte }) };
  }

  const entries = await prisma.financialEntry.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      direction: true,
      status: true,
      amountCents: true,
      description: true,
      dueDate: true,
      paidDate: true,
      orderId: true,
      supplierId: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return NextResponse.json(entries);
});

/** POST /api/admin/finance/entries — cria um lançamento manual (a pagar/receber ou realizado). */
export const POST = handler(async (req) => {
  const admin = await requirePermission("finance.write");
  const body = financialEntrySchema.parse(await req.json());

  const entry = await createEntry(
    {
      direction: body.direction,
      amountCents: body.amountCents,
      description: body.description,
      categoryId: body.categoryId || null,
      supplierId: body.supplierId || null,
      accountId: body.accountId || null,
      dueDate: body.dueDate ?? null,
      status: body.status,
      paidDate: body.paidDate ?? null,
    },
    admin.id
  );

  await audit({
    userId: admin.id,
    action: "finance.entry.create",
    entity: "FinancialEntry",
    entityId: entry.id,
    detail: { direction: entry.direction, amountCents: entry.amountCents, status: entry.status },
    ip: getClientIp(req),
  });

  return NextResponse.json(entry, { status: 201 });
});
