import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import crypto from "crypto";

// ---------------------------------------------------------------
// Integração Mercado Pago — Checkout Pro (SDK oficial v2).
//
// Credenciais no .env (NUNCA hardcoded):
//   MERCADOPAGO_ACCESS_TOKEN            TEST-... (sandbox) | APP_USR-... (produção)
//   MERCADOPAGO_WEBHOOK_SECRET          assinatura secreta do webhook (painel MP)
//
// Sem ACCESS_TOKEN configurado o sistema entra em MODO SIMULADO:
// o checkout funciona e o pagamento é aprovado numa tela local de
// testes (/checkout/simulado) — ideal para experimentar o fluxo
// completo sem conta no Mercado Pago.
// ---------------------------------------------------------------

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no .env");
  }
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

export interface CreatePreferenceParams {
  orderId: string;
  orderNumber: string;
  payerEmail: string;
  payerName: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  shippingCents: number;
  discountCents: number;
}

export interface PreferenceResult {
  preferenceId: string;
  initPoint: string; // URL de redirecionamento do Checkout Pro
}

/** Cria a preferência do Checkout Pro (cartão, Pix e boleto habilitados). */
export async function createPreference(
  params: CreatePreferenceParams
): Promise<PreferenceResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const preference = new Preference(getClient());

  // O Mercado Pago só aceita `auto_return` com back_urls públicas (https).
  // Em localhost, omitimos o auto_return: o pagamento funciona normalmente,
  // mas o cliente precisa clicar em "Voltar para o site" após pagar.
  const isPublicUrl = appUrl.startsWith("https://") && !appUrl.includes("localhost");

  // Desconto de cupom é aplicado proporcionalmente nos itens
  // (a API de preferências não tem campo nativo de desconto).
  const subtotal = params.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const factor = subtotal > 0 ? (subtotal - params.discountCents) / subtotal : 1;

  const result = await preference.create({
    body: {
      external_reference: params.orderId,
      items: params.items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        currency_id: "BRL",
        unit_price: Math.round(item.unitPriceCents * factor) / 100,
      })),
      payer: { email: params.payerEmail, name: params.payerName },
      shipments:
        params.shippingCents > 0
          ? { cost: params.shippingCents / 100, mode: "not_specified" }
          : undefined,
      payment_methods: {
        installments: 12,
        // cartão, Pix e boleto ficam habilitados por padrão;
        // para excluir algum: excluded_payment_types: [{ id: "ticket" }]
      },
      back_urls: {
        success: `${appUrl}/checkout/retorno`,
        pending: `${appUrl}/checkout/retorno`,
        failure: `${appUrl}/checkout/retorno`,
      },
      auto_return: isPublicUrl ? "approved" : undefined,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      statement_descriptor: "GATAFIT",
      metadata: { order_number: params.orderNumber },
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("Mercado Pago: resposta inválida ao criar preferência");
  }
  return { preferenceId: result.id, initPoint: result.init_point };
}

export interface MpPaymentInfo {
  id: string;
  status: string; // approved | pending | in_process | rejected | cancelled | refunded | charged_back
  externalReference: string | null;
  paymentMethodId: string | null; // pix | master | bolbradesco ...
  paymentTypeId: string | null; // credit_card | bank_transfer | ticket ...
  transactionAmount: number | null;
}

/** Consulta um pagamento na API do Mercado Pago. */
export async function getPayment(paymentId: string): Promise<MpPaymentInfo> {
  const payment = await new Payment(getClient()).get({ id: paymentId });
  return {
    id: String(payment.id),
    status: payment.status ?? "unknown",
    externalReference: payment.external_reference ?? null,
    paymentMethodId: payment.payment_method_id ?? null,
    paymentTypeId: payment.payment_type_id ?? null,
    transactionAmount: payment.transaction_amount ?? null,
  };
}

/**
 * Valida a assinatura `x-signature` do webhook (HMAC-SHA256).
 * Manifest oficial: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 * Sem MERCADOPAGO_WEBHOOK_SECRET configurado, aceita (útil em sandbox),
 * mas loga um aviso — configure em produção!
 */
export function validateWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[mercadopago] MERCADOPAGO_WEBHOOK_SECRET ausente — assinatura NÃO verificada");
    return true;
  }
  if (!params.xSignature || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(",").map((p) => p.trim().split("=", 2) as [string, string])
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId ?? ""};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

/** Mapeia status do MP para o status interno do pedido. */
export function mapPaymentStatus(mpStatus: string): string | null {
  switch (mpStatus) {
    case "approved":
      return "PAGO";
    case "pending":
    case "in_process":
    case "authorized":
      return "AGUARDANDO_PAGAMENTO";
    case "rejected":
    case "cancelled":
      return "CANCELADO";
    case "refunded":
    case "charged_back":
      return "REEMBOLSADO";
    default:
      return null;
  }
}
