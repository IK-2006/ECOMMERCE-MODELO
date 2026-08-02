"use client";

import { useEffect } from "react";
import { trackPurchaseBrowser } from "@/lib/track-client";

interface Item {
  id: string;
  name: string;
  priceReais: number;
  quantity: number;
}

/**
 * Dispara o evento Purchase no navegador (Pixel + GA) na página de
 * retorno, com o mesmo event_id do CAPI (deduplicação). Uma vez por pedido.
 */
export function TrackPurchase({
  orderId,
  orderNumber,
  valueReais,
  items,
}: {
  orderId: string;
  orderNumber: string;
  valueReais: number;
  items: Item[];
}) {
  useEffect(() => {
    trackPurchaseBrowser({ orderId, orderNumber, valueReais, items });
  }, [orderId, orderNumber, valueReais, items]);

  return null;
}
