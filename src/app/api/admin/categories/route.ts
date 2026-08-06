import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { categorySchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const admin = await requirePermission("products.write");
  const body = categorySchema.parse(await req.json());

  const slug = body.slug || slugify(body.name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw new ApiError(409, `Já existe uma categoria com o slug "${slug}"`);

  const category = await prisma.category.create({
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
    action: "category.create",
    entity: "Category",
    entityId: category.id,
    detail: { name: category.name },
    ip: getClientIp(req),
  });

  return NextResponse.json(category, { status: 201 });
});
