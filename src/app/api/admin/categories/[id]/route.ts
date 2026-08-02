import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/session";
import { categorySchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = categorySchema.parse(await req.json());

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Categoria não encontrada");

  const slug = body.slug || slugify(body.name);
  const slugTaken = await prisma.category.findFirst({ where: { slug, id: { not: id } } });
  if (slugTaken) throw new ApiError(409, `Já existe uma categoria com o slug "${slug}"`);

  const category = await prisma.category.update({
    where: { id },
    data: {
      name: body.name,
      slug,
      description: body.description || null,
      position: body.position,
      active: body.active,
    },
  });

  await audit({
    userId: admin.id,
    action: "category.update",
    entity: "Category",
    entityId: id,
    ip: getClientIp(req),
  });

  return NextResponse.json(category);
});

export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new ApiError(409, `Esta categoria tem ${count} produto(s). Mova-os antes de excluir.`);
  }

  await prisma.category.delete({ where: { id } });
  await audit({
    userId: admin.id,
    action: "category.delete",
    entity: "Category",
    entityId: id,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
