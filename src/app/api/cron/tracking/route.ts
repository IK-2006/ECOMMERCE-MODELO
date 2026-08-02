import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { refreshAllActiveTracking } from "@/services/shipping/labels";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Comparação de segredos em tempo constante (evita timing attack). */
function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-cron-secret");
  if (header) return header.trim();
  const qs = new URL(req.url).searchParams.get("secret");
  return qs ? qs.trim() : null;
}

/**
 * Sincroniza o rastreio de todos os pedidos ENVIADO com etiqueta ativa.
 * Protegido por CRON_SECRET (header Authorization: Bearer, x-cron-secret
 * ou ?secret=). Sem CRON_SECRET configurado, o endpoint fica DESLIGADO.
 *
 * Agende (VPS) uma chamada periódica (ex.: de 3 em 3 horas) via cron:
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://SEU-DOMINIO/api/cron/tracking
 * (o formato do crontab está documentado em MELHOR-ENVIO-ETIQUETAS.md)
 */
async function runCron(req: Request) {
  if (!secretMatches(extractSecret(req))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await refreshAllActiveTracking();
    await audit({
      action: "shipping.tracking_cron",
      entity: "Order",
      detail: result,
      ip: getClientIp(req),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/tracking] falha:", err);
    return NextResponse.json({ error: "Falha ao sincronizar rastreio" }, { status: 500 });
  }
}

export const GET = runCron;
export const POST = runCron;
