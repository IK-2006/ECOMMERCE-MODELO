import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { verifyToken } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().trim().min(6).max(8) });

/**
 * POST /api/account/2fa/enable — confirma o código do app autenticador e
 * ativa o 2FA. Exige que /setup tenha gerado um segredo antes.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { token } = schema.parse(await req.json());

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.twoFactorSecret) {
    throw new ApiError(400, "Inicie a configuração do 2FA antes de confirmar");
  }
  if (!verifyToken(token, dbUser.twoFactorSecret)) {
    throw new ApiError(400, "Código inválido. Verifique o app e tente novamente.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  });

  await audit({
    userId: user.id,
    action: "2fa.enable",
    entity: "User",
    entityId: user.id,
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
});
