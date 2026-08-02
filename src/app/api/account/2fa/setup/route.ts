import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { generateSecret, otpauthUrl } from "@/lib/totp";

/**
 * POST /api/account/2fa/setup — inicia o enrolamento do 2FA:
 * gera um segredo (ainda NÃO ativa), grava-o e devolve o QR code +
 * o segredo para digitação manual. O 2FA só é ativado após confirmar
 * um código em /enable.
 */
export const POST = handler(async () => {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new ApiError(404, "Usuário não encontrado");
  if (dbUser.twoFactorEnabled) {
    throw new ApiError(400, "A verificação em duas etapas já está ativa");
  }

  const secret = generateSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  const url = otpauthUrl(dbUser.email, secret);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });

  return NextResponse.json({ qr: qrDataUrl, secret });
});
