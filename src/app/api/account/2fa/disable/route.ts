import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1) });

/**
 * POST /api/account/2fa/disable — desativa o 2FA. Exige a senha atual
 * como confirmação (evita que alguém com a sessão aberta desligue).
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { password } = schema.parse(await req.json());

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new ApiError(404, "Usuário não encontrado");
  if (!dbUser.passwordHash || !(await bcrypt.compare(password, dbUser.passwordHash))) {
    throw new ApiError(400, "Senha incorreta");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  await audit({
    userId: user.id,
    action: "2fa.disable",
    entity: "User",
    entityId: user.id,
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
});
