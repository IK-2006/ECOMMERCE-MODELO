"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/lib/track-client";

/** Dispara o evento ViewContent ao abrir a página de um produto. */
export function TrackView({
  id,
  name,
  priceReais,
}: {
  id: string;
  name: string;
  priceReais: number;
}) {
  useEffect(() => {
    trackViewContent({ id, name, priceReais });
  }, [id, name, priceReais]);

  return null;
}
