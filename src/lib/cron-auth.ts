import { timingSafeEqual } from "node:crypto";

/** Extrai o segredo do cron: Authorization: Bearer, header x-cron-secret ou ?secret=. */
function extractSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-cron-secret");
  if (header) return header.trim();
  const qs = new URL(req.url).searchParams.get("secret");
  return qs ? qs.trim() : null;
}

/**
 * Autoriza uma requisição de cron comparando o segredo em TEMPO CONSTANTE.
 * Sem CRON_SECRET configurado, retorna false (endpoints de cron ficam DESLIGADOS).
 */
export function cronAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const provided = extractSecret(req);
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
