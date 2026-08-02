import { CorreiosProvider } from "./correios";
import { FallbackProvider } from "./fallback";
import { MelhorEnvioProvider } from "./melhorenvio";
import type { ShippingPackage, ShippingProvider, ShippingQuote } from "./types";

export type { ShippingPackage, ShippingProvider, ShippingQuote };

/** Credenciais do Melhor Envio configuradas (token manual ou client_credentials)? */
export function hasMelhorEnvioCredentials(): boolean {
  return Boolean(
    process.env.MELHOR_ENVIO_TOKEN ||
      (process.env.MELHOR_ENVIO_CLIENT_ID && process.env.MELHOR_ENVIO_CLIENT_SECRET)
  );
}

/** Há credenciais de contrato dos Correios configuradas? */
export function hasCorreiosCredentials(): boolean {
  return Boolean(
    process.env.CORREIOS_USUARIO &&
      process.env.CORREIOS_CODIGO_ACESSO &&
      process.env.CORREIOS_CONTRATO
  );
}

/**
 * Seleciona o provider ativo, por ordem de preferência:
 *  1. Melhor Envio  (token no .env) — várias transportadoras, sem contrato
 *  2. Correios      (API CWS, exige contrato)
 *  3. Tabela interna (ShippingRule cadastrável no admin) — fallback
 */
export function getShippingProvider(): ShippingProvider {
  if (hasMelhorEnvioCredentials()) return new MelhorEnvioProvider();
  if (hasCorreiosCredentials()) return new CorreiosProvider();
  return new FallbackProvider();
}

/** Retirada na loja está habilitada no .env? */
export function hasStorePickup(): boolean {
  return process.env.STORE_PICKUP_ENABLED === "true";
}

/** Opção "Retirar na loja" (frete grátis), quando habilitada no .env. */
function pickupQuote(): ShippingQuote | null {
  if (!hasStorePickup()) return null;
  return {
    carrier: "RETIRADA",
    service: "retirada",
    serviceName: process.env.STORE_PICKUP_LABEL || "Retirar na loja",
    priceCents: 0,
    days: Number(process.env.STORE_PICKUP_DAYS) || 1, // dias p/ preparar o pedido
  };
}

/**
 * Opção de retirada na loja (ou null se desabilitada). Exposta para o
 * checkout tratar a retirada como MÉTODO DE ENTREGA (não como frete).
 */
export function getPickupOption(): ShippingQuote | null {
  return pickupQuote();
}

/**
 * Cota o frete com fallback: se o provider externo (Melhor Envio / Correios)
 * falhar ou não retornar opções, cai para a tabela interna em vez de
 * quebrar o checkout. Sempre acrescenta a retirada na loja, se habilitada.
 */
export async function quoteShipping(
  cepDestino: string,
  pkg: ShippingPackage
): Promise<ShippingQuote[]> {
  const provider = getShippingProvider();
  let quotes: ShippingQuote[] = [];
  try {
    quotes = await provider.quote(cepDestino, pkg);
  } catch (err) {
    console.error(`[shipping] provider ${provider.name} falhou:`, err);
  }
  if (quotes.length === 0 && provider.name !== "TABELA_INTERNA") {
    try {
      quotes = await new FallbackProvider().quote(cepDestino, pkg);
    } catch (err) {
      console.error("[shipping] fallback (tabela interna) falhou:", err);
    }
  }

  // retirada na loja: sempre disponível (não depende de transportadora)
  const pickup = pickupQuote();
  if (pickup) quotes.push(pickup);

  return quotes;
}

/** Agrega itens do carrinho em um pacote único para cotação. */
export function buildPackage(
  items: Array<{ quantity: number; weightGrams: number; unitPriceCents: number }>,
  dims?: { lengthCm: number; widthCm: number; heightCm: number }
): ShippingPackage {
  return {
    weightGrams: items.reduce((sum, i) => sum + i.weightGrams * i.quantity, 0),
    lengthCm: dims?.lengthCm ?? 30,
    widthCm: dims?.widthCm ?? 25,
    heightCm: dims?.heightCm ?? 15,
    declaredValueCents: items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
  };
}
