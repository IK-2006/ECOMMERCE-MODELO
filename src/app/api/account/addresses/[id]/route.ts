import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { addressSchema } from "@/lib/validations";

async function findOwnAddress(id: string, userId: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw new ApiError(404, "Endereço não encontrado");
  return address;
}

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await findOwnAddress(id, user.id);

  const body = addressSchema.parse(await req.json());

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return tx.address.update({
      where: { id },
      data: {
        label: body.label,
        recipient: body.recipient,
        cep: body.cep,
        street: body.street,
        number: body.number,
        complement: body.complement || null,
        district: body.district,
        city: body.city,
        state: body.state.toUpperCase(),
        phone: body.phone || null,
        isDefault: body.isDefault ?? false,
      },
    });
  });

  return NextResponse.json(address);
});

export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await findOwnAddress(id, user.id);
  await prisma.address.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
