import { authenticator } from "otplib";

// ---------------------------------------------------------------
// Autenticação de dois fatores (2FA) via TOTP — compatível com
// Google Authenticator, Authy, Microsoft Authenticator, etc.
// ---------------------------------------------------------------

// tolerância de 1 janela (30s) para diferença de relógio
authenticator.options = { window: 1 };

export const TOTP_ISSUER = "Gata Fit Admin";

/** Gera um novo segredo base32. */
export function generateSecret(): string {
  return authenticator.generateSecret();
}

/** URI otpauth:// para gerar o QR code de enrolamento. */
export function otpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, TOTP_ISSUER, secret);
}

/** Verifica um código de 6 dígitos contra o segredo. */
export function verifyToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}
