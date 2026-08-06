import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { customerProfileSchema } from "@/lib/validations";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/customers/[id] — salva tags/notas de CRM do cliente. */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("customers.write");
  const { id } = await ctx.params;
  const body = customerProfileSchema.parse(await req.json());

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new ApiError(404, "Cliente não encontrado");

  const tags = (body.tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .join(",");

  const profile = await prisma.customerProfile.upsert({
    where: { userId: id },
    update: { tags: tags || null, notes: body.notes || null },
    create: { userId: id, tags: tags || null, notes: body.notes || null },
  });

  await audit({
    userId: admin.id,
    action: "customer.profile_update",
    entity: "CustomerProfile",
    entityId: id,
    detail: { tags },
    ip: getClientIp(req),
  });

  return NextResponse.json(profile);
});
