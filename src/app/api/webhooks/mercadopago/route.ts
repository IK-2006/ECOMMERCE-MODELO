import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { updateOrderStatus } from "@/services/orders";
import {
  getPayment,
  mapPaymentStatus,
  validateWebhookSignature,
} from "@/services/payments/mercadopago";

/**
 * POST /api/webhooks/mercadopago
 *
 * Recebe notificações de pagamento do Mercado Pago e atualiza o pedido.
 * - valida a assinatura HMAC (x-signature) quando MERCADOPAGO_WEBHOOK_SECRET
 *   está configurado
 * - idempotente: eventos repetidos são ignorados (tabela WebhookEvent)
 * - o status é sempre consultado NA API do MP (nunca confiamos no body)
 *
 * Configure no painel do MP: URL {SEU_DOMINIO}/api/webhooks/mercadopago,
 * evento "Pagamentos". Em dev, exponha com `ngrok http 3000`.
 */
export async function POST(req: Request) {
  let payload: { type?: string; action?: string; data?: { id?: string | number } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const url = new URL(req.url);
  const dataId = String(payload.data?.id ?? url.searchParams.get("data.id") ?? "");
  const type = payload.type ?? url.searchParams.get("type") ?? "";

  // só processamos eventos de pagamento
  if (type !== "payment" || !dataId) {
    return NextResponse.json({ received: true });
  }

  const signatureValid = validateWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
  });
  if (!signatureValid) {
    console.warn("[webhook:mp] assinatura inválida para payment", dataId);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  // idempotência — evento já processado retorna 200 direto
  const eventKey = { provider: "mercadopago", externalId: dataId, type: "payment" };
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalId_type: eventKey },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, duplicated: true });
  }

  const event =
    existing ??
    (await prisma.webhookEvent.create({
      data: { ...eventKey, payload: JSON.stringify(payload).slice(0, 8000) },
    }));

  try {
    // consulta o pagamento na API oficial (fonte de verdade)
    let payment;
    try {
      payment = await getPayment(dataId);
    } catch (err) {
      // pagamento inexistente (notificação obsoleta/forjada): reconhece e
      // descarta — evita que o MP reenvie em loop uma notificação morta.
      if ((err as { status?: number })?.status === 404) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date(), error: "payment_not_found" },
        });
        return NextResponse.json({ received: true, ignored: "payment_not_found" });
      }
      throw err; // demais erros (transitórios) → 500 para o MP reenviar
    }
    const orderId = payment.externalReference;
    const newStatus = mapPaymentStatus(payment.status);

    if (orderId && newStatus) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order) {
        // não regride pedido já pago para cancelado por evento atrasado
        const isRegression =
          ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"].includes(order.status) &&
          newStatus === "CANCELADO";
        // não sobrescreve reembolso
        const isFinal = ["REEMBOLSADO"].includes(order.status);

        if (!isRegression && !isFinal && order.status !== newStatus) {
          await updateOrderStatus({
            orderId,
            status: newStatus,
            note: `Mercado Pago: pagamento ${payment.id} → ${payment.status}`,
            paymentInfo: {
              mpPaymentId: payment.id,
              paymentMethod: payment.paymentTypeId ?? payment.paymentMethodId ?? undefined,
            },
          });
        }
      } else {
        console.warn("[webhook:mp] pedido não encontrado:", orderId);
      }
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date(), error: null },
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook:mp] erro ao processar:", err);
    Sentry.captureException(err, { tags: { area: "webhook.mercadopago" } });
    await prisma.webhookEvent
      .update({
        where: { id: event.id },
        data: { error: err instanceof Error ? err.message : String(err) },
      })
      .catch(() => null);
    // 500 faz o Mercado Pago reenviar a notificação depois
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 });
  }
}
