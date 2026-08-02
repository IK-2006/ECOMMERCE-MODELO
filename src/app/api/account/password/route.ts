import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handler, ApiError, tooMany } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export const PATCH = handler(async (req) => {
  const user = await requireUser();

  const limit = rateLimit(`chpass:${user.id}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const body = changePasswordSchema.parse(await req.json());

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash) {
    throw new ApiError(400, "Conta sem senha (login social). Use a recuperação de senha.");
  }

  const valid = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
  if (!valid) throw new ApiError(400, "Senha atual incorreta");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(body.newPassword, 12) },
  });

  return NextResponse.json({ ok: true });
});
