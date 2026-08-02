// =====================================================================
// MELHOR ENVIO — GERAÇÃO DE ETIQUETAS (camada de API pura)
// ---------------------------------------------------------------------
// Enquanto a COTAÇÃO (melhorenvio.ts) usa o fluxo client_credentials
// (escopo shipping-calculate), a EMISSÃO DE ETIQUETA exige um TOKEN
// PESSOAL da conta, gerado no painel do Melhor Envio com os escopos:
//   shipping-cart  shipping-checkout  shipping-generate
//   shipping-print shipping-tracking
//
// Esse token vai na variável de ambiente MELHOR_ENVIO_TOKEN (no serviço
// de hospedagem, NUNCA no código). Sem ele, a emissão é bloqueada com
// uma mensagem clara — o client_credentials não tem permissão de etiqueta.
//
// Fluxo oficial (cada passo é uma chamada distinta):
//   1. POST /api/v2/me/cart              → adiciona o frete ao carrinho
//   2. POST /api/v2/me/shipment/checkout → paga com o SALDO da conta
//   3. POST /api/v2/me/shipment/generate → gera a etiqueta (autoriza)
//   4. POST /api/v2/me/shipment/print    → devolve a URL do PDF
//   5. POST /api/v2/me/shipment/tracking → código de rastreio + status
//
// Docs: https://docs.melhorenvio.com.br/reference
// =====================================================================

import { baseUrl, userAgent } from "./melhorenvio";

export class MelhorEnvioLabelError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "MelhorEnvioLabelError";
  }
}

/** Há token pessoal configurado para emitir etiquetas? */
export function melhorEnvioLabelsEnabled(): boolean {
  return Boolean(process.env.MELHOR_ENVIO_TOKEN);
}

/** Token pessoal (obrigatório para etiquetas). Lança erro claro se ausente. */
function getLabelToken(): string {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) {
    throw new MelhorEnvioLabelError(
      "Emissão de etiqueta indisponível: configure MELHOR_ENVIO_TOKEN (token " +
        "pessoal do Melhor Envio com escopos de carrinho, checkout, geração, " +
        "impressão e rastreio) no serviço de hospedagem.",
      422,
    );
  }
  return token;
}

/** Extrai o id numérico do serviço a partir do código salvo ("me-1" → 1). */
export function parseMeServiceId(code: string | null | undefined): number | null {
  if (!code) return null;
  const m = /^me-(\d+)$/.exec(code.trim());
  if (m) return Number(m[1]);
  // tolera um número puro salvo diretamente
  if (/^\d+$/.test(code.trim())) return Number(code.trim());
  return null;
}

/** Chamada autenticada ao Melhor Envio com tratamento de erro uniforme. */
async function meFetch<T>(path: string, body: unknown): Promise<T> {
  const token = getLabelToken();
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgent(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MelhorEnvioLabelError(
      "Não foi possível contatar o Melhor Envio (tempo esgotado ou rede).",
      504,
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }

  if (!res.ok) {
    throw new MelhorEnvioLabelError(extractError(data, res.status), res.status);
  }
  return data as T;
}

/** Transforma o corpo de erro do ME numa mensagem legível. */
function extractError(data: unknown, status: number): string {
  const d = data as
    | { message?: string; error?: string; errors?: Record<string, string[]> }
    | null;
  if (d?.errors && typeof d.errors === "object") {
    const first = Object.values(d.errors)[0];
    if (Array.isArray(first) && first[0]) return `Melhor Envio: ${first[0]}`;
  }
  if (d?.message) return `Melhor Envio: ${d.message}`;
  if (d?.error) return `Melhor Envio: ${d.error}`;
  if (status === 401 || status === 403)
    return "Melhor Envio: token inválido ou sem os escopos de etiqueta.";
  return `Melhor Envio: falha na operação (HTTP ${status}).`;
}

// --------------------------- tipos de payload -------------------------

export interface MeAddress {
  name: string;
  phone?: string;
  email?: string;
  document?: string; // CPF/CNPJ (dígitos)
  company_document?: string;
  address: string;
  complement?: string;
  number: string;
  district: string;
  city: string;
  state_abbr: string;
  postal_code: string;
  note?: string;
}

export interface MeVolume {
  height: number; // cm
  width: number; // cm
  length: number; // cm
  weight: number; // kg
}

export interface MeProduct {
  name: string;
  quantity: number;
  unitary_value: number; // reais
}

export interface CartPayload {
  service: number;
  from: MeAddress;
  to: MeAddress;
  products: MeProduct[];
  volumes: MeVolume[];
  options: {
    insurance_value: number;
    receipt: boolean;
    own_hand: boolean;
    reverse: boolean;
    non_commercial: boolean;
  };
}

// --------------------------- passos da API ----------------------------

interface CartResponse {
  id: string;
  protocol?: string;
  status?: string;
}

/** 1. Adiciona o frete ao carrinho. Devolve o id da etiqueta no ME. */
export async function addToCart(payload: CartPayload): Promise<{ id: string; protocol: string | null }> {
  const data = await meFetch<CartResponse>("/api/v2/me/cart", payload);
  if (!data?.id) throw new MelhorEnvioLabelError("Melhor Envio: carrinho sem id de etiqueta.");
  return { id: data.id, protocol: data.protocol ?? null };
}

/** 2. Paga a etiqueta com o SALDO da conta Melhor Envio. */
export async function checkoutCart(orderIds: string[]): Promise<void> {
  await meFetch("/api/v2/me/shipment/checkout", { orders: orderIds });
}

/** 3. Gera (autoriza) a etiqueta. */
export async function generateLabels(orderIds: string[]): Promise<void> {
  await meFetch("/api/v2/me/shipment/generate", { orders: orderIds });
}

/** 4. Devolve a URL pública do PDF da etiqueta. */
export async function getPrintUrl(orderIds: string[]): Promise<string> {
  const data = await meFetch<{ url?: string }>("/api/v2/me/shipment/print", {
    mode: "public",
    orders: orderIds,
  });
  if (!data?.url) throw new MelhorEnvioLabelError("Melhor Envio: PDF da etiqueta indisponível.");
  return data.url;
}

export interface MeTracking {
  status: string | null; // pending | released | posted | delivered | canceled ...
  tracking: string | null; // código de rastreio da transportadora
  postedAt: string | null;
  deliveredAt: string | null;
}

/** 5. Consulta o rastreio/status de uma ou mais etiquetas. */
export async function getTrackingInfo(
  orderIds: string[],
): Promise<Record<string, MeTracking>> {
  const data = await meFetch<Record<string, Record<string, unknown>>>(
    "/api/v2/me/shipment/tracking",
    { orders: orderIds },
  );
  const out: Record<string, MeTracking> = {};
  for (const [id, raw] of Object.entries(data ?? {})) {
    out[id] = {
      status: (raw?.status as string) ?? null,
      tracking: (raw?.tracking as string) ?? null,
      postedAt: (raw?.posted_at as string) ?? null,
      deliveredAt: (raw?.delivered_at as string) ?? null,
    };
  }
  return out;
}
