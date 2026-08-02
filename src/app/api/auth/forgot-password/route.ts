import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { handler, tooMany } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordReset } from "@/lib/email";

export const POST = handler(async (req) => {
  const ip = getClientIp(req);
  const limit = rateLimit(`forgot:${ip}`, 5, 30 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const { email } = forgotPasswordSchema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email } });

  // resposta idêntica exista ou não a conta (não vaza e-mails cadastrados)
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      },
    });
    void sendPasswordReset(user.email, user.name, token);
  }

  return NextResponse.json({ ok: true });
});
