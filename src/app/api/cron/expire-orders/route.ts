import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { expireStaleOrders } from "@/services/orders";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cancela pedidos ONLINE presos em AGUARDANDO_PAGAMENTO há mais de
 * ORDER_EXPIRY_HOURS horas e devolve o estoque reservado.
 *
 * Protegido por CRON_SECRET. Desligado se CRON_SECRET ou ORDER_EXPIRY_HOURS
 * não estiverem definidos. Agende no VPS (ex.: de hora em hora):
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://SEU-DOMINIO/api/cron/expire-orders
 */
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const result = await expireStaleOrders();
    if (!result.disabled) {
      await audit({
        action: "orders.expire_cron",
        entity: "Order",
        detail: result,
        ip: getClientIp(req),
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/expire-orders] falha:", err);
    return NextResponse.json({ error: "Falha ao expirar pedidos" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
