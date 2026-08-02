import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { profileSchema } from "@/lib/validations";

export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const body = profileSchema.parse(await req.json());

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: body.name,
      phone: body.phone || null,
      cpf: body.cpf || null,
    },
  });

  return NextResponse.json({ ok: true });
});
