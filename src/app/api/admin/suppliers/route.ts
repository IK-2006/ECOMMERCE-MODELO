import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { supplierSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/suppliers — lista fornecedores */
export const GET = handler(async () => {
  await requirePermission("suppliers.write");
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(suppliers);
});

/** POST /api/admin/suppliers — cria fornecedor */
export const POST = handler(async (req) => {
  const admin = await requirePermission("suppliers.write");
  const body = supplierSchema.parse(await req.json());

  const supplier = await prisma.supplier.create({
    data: {
      name: body.name,
      cnpj: body.cnpj || null,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
      active: body.active,
    },
  });

  await audit({
    userId: admin.id,
    action: "supplier.create",
    entity: "Supplier",
    entityId: supplier.id,
    detail: { name: supplier.name },
    ip: getClientIp(req),
  });

  return NextResponse.json(supplier, { status: 201 });
});
