import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { handler, tooMany } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const ip = getClientIp(req);
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const body = registerSchema.parse(await req.json());

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma conta com este e-mail" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  await prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
});
