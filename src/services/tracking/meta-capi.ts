import crypto from "crypto";

// ---------------------------------------------------------------
// API de Conversões da Meta (CAPI) — eventos SERVER-SIDE.
//
// Por que server-side? O Pixel no navegador é bloqueado por
// bloqueadores de anúncio e pelo iOS. O CAPI manda o evento de
// COMPRA direto do nosso servidor para a Meta → muito mais confiável
// para otimizar campanhas e medir o retorno (ROAS).
//
// PII (e-mail/telefone) é enviada com HASH SHA-256 (exigência da Meta).
// Gated por env: sem PIXEL_ID + ACCESS_TOKEN, é no-op.
// ---------------------------------------------------------------

const GRAPH_VERSION = "v21.0";

function config() {
  return {
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
    token: process.env.META_CAPI_ACCESS_TOKEN || "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

interface PurchaseInput {
  orderId: string; // usado como event_id (deduplicação)
  orderNumber: string;
  totalCents: number;
  email: string;
  phone?: string | null;
  items: Array<{ productId: string | null; quantity: number; unitPriceCents: number }>;
}

/** Envia o evento Purchase para a Meta (não bloqueante, tolerante a falha). */
export async function trackPurchase(input: PurchaseInput): Promise<void> {
  const { pixelId, token, appUrl } = config();
  if (!pixelId || !token) return; // módulo desligado

  const userData: Record<string, string[]> = { em: [sha256(input.email)] };
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    if (digits) userData.ph = [sha256(digits)];
  }

  const event = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.orderId, // dedup com um eventual Purchase do Pixel
    action_source: "website",
    event_source_url: `${appUrl}/checkout/retorno`,
    user_data: userData,
    custom_data: {
      currency: "BRL",
      value: Number((input.totalCents / 100).toFixed(2)),
      order_id: input.orderNumber,
      num_items: input.items.reduce((s, i) => s + i.quantity, 0),
      content_type: "product",
      contents: input.items
        .filter((i) => i.productId)
        .map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          item_price: Number((i.unitPriceCents / 100).toFixed(2)),
        })),
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      console.error("[meta-capi] falha HTTP", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[meta-capi] erro ao enviar Purchase:", err);
  }
}
