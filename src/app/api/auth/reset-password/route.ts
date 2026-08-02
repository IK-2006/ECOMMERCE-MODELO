import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations";
import { handler, tooMany } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const ip = getClientIp(req);
  const limit = rateLimit(`reset:${ip}`, 10, 30 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const { token, password } = resetPasswordSchema.parse(await req.json());

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Link inválido ou expirado. Solicite um novo." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
});
