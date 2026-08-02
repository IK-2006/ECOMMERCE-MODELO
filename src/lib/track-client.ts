// Disparo de eventos de conversão no CLIENTE (Meta Pixel + GA4).
// O evento de COMPRA NÃO fica aqui — é server-side (CAPI), mais confiável.
//
// Buffer: os efeitos do React rodam de baixo pra cima, então um evento
// (ex.: ViewContent) pode ser chamado ANTES de o Pixel/GA carregarem.
// Guardamos numa fila e liberamos quando o rastreamento estiver pronto
// (markTrackingReady, chamado pelo <Analytics/> após carregar os scripts).
// Enquanto o consentimento não é dado, a fila nunca é liberada → nada dispara.

type Fire = () => void;

let ready = false;
const pending: Fire[] = [];

/** Chamado pelo <Analytics/> após carregar Pixel/GA (com consentimento). */
export function markTrackingReady() {
  ready = true;
  while (pending.length) {
    const fire = pending.shift();
    try {
      fire?.();
    } catch {
      /* ignora — rastreamento nunca quebra a loja */
    }
  }
}

function run(fire: Fire) {
  if (typeof window === "undefined") return;
  if (ready && window.fbq) fire();
  else pending.push(fire);
}

interface ItemData {
  id: string;
  name: string;
  priceReais: number;
  quantity?: number;
}

const metaContents = (items: ItemData[]) =>
  items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.priceReais }));
const ga4Items = (items: ItemData[]) =>
  items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    price: i.priceReais,
    quantity: i.quantity ?? 1,
  }));

/** Visualização de produto. */
export function trackViewContent(item: ItemData) {
  run(() => {
    window.fbq?.("track", "ViewContent", {
      content_ids: [item.id],
      content_name: item.name,
      content_type: "product",
      value: item.priceReais,
      currency: "BRL",
    });
    window.gtag?.("event", "view_item", {
      currency: "BRL",
      value: item.priceReais,
      items: ga4Items([item]),
    });
  });
}

/** Adição ao carrinho. */
export function trackAddToCart(item: ItemData) {
  const value = item.priceReais * (item.quantity ?? 1);
  run(() => {
    window.fbq?.("track", "AddToCart", {
      content_ids: [item.id],
      content_name: item.name,
      content_type: "product",
      contents: metaContents([item]),
      value,
      currency: "BRL",
    });
    window.gtag?.("event", "add_to_cart", { currency: "BRL", value, items: ga4Items([item]) });
  });
}

/**
 * COMPRA no navegador (Pixel + GA). O `eventID` é o id do pedido — o
 * MESMO usado no CAPI (server-side) → a Meta deduplica e conta 1 só vez.
 * Dispara no máximo uma vez por pedido (guarda no localStorage).
 */
export function trackPurchaseBrowser(input: {
  orderId: string;
  orderNumber: string;
  valueReais: number;
  items: ItemData[];
}) {
  if (typeof window === "undefined") return;
  const key = `purchase_fired_${input.orderId}`;
  if (localStorage.getItem(key)) return;
  run(() => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    window.fbq?.(
      "track",
      "Purchase",
      {
        content_ids: input.items.map((i) => i.id),
        content_type: "product",
        contents: metaContents(input.items),
        num_items: input.items.reduce((s, i) => s + (i.quantity ?? 1), 0),
        value: input.valueReais,
        currency: "BRL",
      },
      { eventID: input.orderId } // deduplicação com o CAPI
    );
    window.gtag?.("event", "purchase", {
      transaction_id: input.orderNumber,
      value: input.valueReais,
      currency: "BRL",
      items: ga4Items(input.items),
    });
  });
}

/** Início do checkout. */
export function trackInitiateCheckout(items: ItemData[], valueReais: number) {
  run(() => {
    window.fbq?.("track", "InitiateCheckout", {
      content_ids: items.map((i) => i.id),
      content_type: "product",
      contents: metaContents(items),
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      value: valueReais,
      currency: "BRL",
    });
    window.gtag?.("event", "begin_checkout", {
      currency: "BRL",
      value: valueReais,
      items: ga4Items(items),
    });
  });
}
