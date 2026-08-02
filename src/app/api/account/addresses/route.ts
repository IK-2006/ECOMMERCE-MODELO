import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { addressSchema } from "@/lib/validations";

/** POST /api/account/addresses — cria endereço */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = addressSchema.parse(await req.json());

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        userId: user.id,
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

  return NextResponse.json(address, { status: 201 });
});
