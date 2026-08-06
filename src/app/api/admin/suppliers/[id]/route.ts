import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { supplierSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/suppliers/[id] — edita fornecedor */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("suppliers.write");
  const { id } = await ctx.params;
  const body = supplierSchema.parse(await req.json());

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Fornecedor não encontrado");

  const supplier = await prisma.supplier.update({
    where: { id },
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
    action: "supplier.update",
    entity: "Supplier",
    entityId: id,
    ip: getClientIp(req),
  });

  return NextResponse.json(supplier);
});

/** DELETE /api/admin/suppliers/[id] — exclui (ou desativa se já usado) */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("suppliers.write");
  const { id } = await ctx.params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new ApiError(404, "Fornecedor não encontrado");

  // se já há produtos ou entradas ligadas, apenas desativa (preserva histórico)
  const used =
    (await prisma.product.count({ where: { supplierId: id } })) +
    (await prisma.stockMovement.count({ where: { supplierId: id } }));

  if (used > 0) {
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    await audit({ userId: admin.id, action: "supplier.deactivate", entity: "Supplier", entityId: id, ip: getClientIp(req) });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.supplier.delete({ where: { id } });
  await audit({ userId: admin.id, action: "supplier.delete", entity: "Supplier", entityId: id, ip: getClientIp(req) });
  return NextResponse.json({ ok: true, deleted: true });
});
