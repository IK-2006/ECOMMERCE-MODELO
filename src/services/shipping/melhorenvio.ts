import type {
  ShippingPackage,
  ShippingProvider,
  ShippingQuote,
  TrackingEvent,
} from "./types";

// ---------------------------------------------------------------
// Integração com o MELHOR ENVIO (agregador de fretes).
// Docs: https://docs.melhorenvio.com.br
//
// Vantagem: cotação real de VÁRIAS transportadoras (Correios PAC/SEDEX,
// Jadlog, Loggi, Azul...) SEM contrato próprio — você usa o contrato do
// Melhor Envio. Cadastro gratuito, paga só por etiqueta emitida.
//
// Autenticação: OAuth2 "client_credentials" — o sistema troca
// CLIENT_ID + CLIENT_SECRET por um access_token automaticamente e o
// renova sozinho quando expira (validade ~30 dias). Não exige
// autorização manual nem URL de callback.
//
// Credenciais no .env:
//   MELHOR_ENVIO_CLIENT_ID       Client ID do app (Painel > Área Dev.)
//   MELHOR_ENVIO_CLIENT_SECRET   Client Secret do app
//   MELHOR_ENVIO_AMBIENTE        "producao" | "sandbox"
//   MELHOR_ENVIO_FROM_CEP        CEP de origem das postagens
//   MELHOR_ENVIO_USER_AGENT      identificação exigida pela API (app + e-mail)
//   MELHOR_ENVIO_TOKEN           (opcional) token fixo, sobrepõe o fluxo acima
//
// Rastreio automático depende do fluxo de compra de etiqueta do Melhor
// Envio; por ora o admin informa o código de rastreio manualmente.
// ---------------------------------------------------------------

const BASE_URLS = {
  producao: "https://www.melhorenvio.com.br",
  sandbox: "https://sandbox.melhorenvio.com.br",
} as const;

export function baseUrl() {
  return process.env.MELHOR_ENVIO_AMBIENTE === "sandbox"
    ? BASE_URLS.sandbox
    : BASE_URLS.producao;
}

/** A API do Melhor Envio EXIGE um User-Agent identificando a aplicação + contato. */
export function userAgent() {
  return (
    process.env.MELHOR_ENVIO_USER_AGENT || "Gata Fit (contato@usegatafit.com.br)"
  );
}

// token em cache (memória) — renovado automaticamente perto do vencimento
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Obtém um access_token válido:
 *  - se MELHOR_ENVIO_TOKEN estiver definido, usa ele direto (override manual);
 *  - senão troca CLIENT_ID/SECRET por um token via client_credentials e cacheia.
 */
async function getAccessToken(): Promise<string> {
  const manual = process.env.MELHOR_ENVIO_TOKEN;
  if (manual) return manual;

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(`${baseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgent(),
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.MELHOR_ENVIO_CLIENT_ID,
      client_secret: process.env.MELHOR_ENVIO_CLIENT_SECRET,
      scope: "shipping-calculate",
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`Melhor Envio: falha ao obter token (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  if (!data.access_token) throw new Error("Melhor Envio: token ausente na resposta");

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 2_592_000) * 1000,
  };
  return data.access_token;
}

interface MEOption {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  company?: { id: number; name: string };
  error?: string; // presente quando o serviço não atende a rota
}

export class MelhorEnvioProvider implements ShippingProvider {
  readonly name = "MELHOR_ENVIO";

  async quote(cepDestino: string, pkg: ShippingPackage): Promise<ShippingQuote[]> {
    const token = await getAccessToken();
    const fromCep = (
      process.env.MELHOR_ENVIO_FROM_CEP ||
      process.env.CORREIOS_CEP_ORIGEM ||
      "01001000"
    ).replace(/\D/g, "");

    const res = await fetch(`${baseUrl()}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgent(),
      },
      body: JSON.stringify({
        from: { postal_code: fromCep },
        to: { postal_code: cepDestino.replace(/\D/g, "") },
        // pacote único agregado (peso em KG; dimensões em cm)
        package: {
          height: Math.max(1, pkg.heightCm),
          width: Math.max(1, pkg.widthCm),
          length: Math.max(1, pkg.lengthCm),
          weight: Math.max(0.1, pkg.weightGrams / 1000),
        },
        options: {
          insurance_value: pkg.declaredValueCents / 100,
          receipt: false,
          own_hand: false,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      throw new Error(`Melhor Envio: HTTP ${res.status}`);
    }

    const data = (await res.json()) as MEOption[];
    if (!Array.isArray(data)) throw new Error("Melhor Envio: resposta inesperada");

    // transportadoras permitidas (MELHOR_ENVIO_TRANSPORTADORAS no .env).
    // Vazio = mostra todas. Ex.: "Correios,Jadlog" mostra só essas.
    const allow = (process.env.MELHOR_ENVIO_TRANSPORTADORAS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    return data
      // remove serviços indisponíveis para a rota (vêm com `error`) e sem preço
      .filter((o) => !o.error && (o.custom_price || o.price))
      // filtra por transportadora, se configurado
      .filter(
        (o) =>
          allow.length === 0 ||
          allow.some((a) => (o.company?.name ?? "").toLowerCase().includes(a))
      )
      .map((o) => {
        const company = o.company?.name ?? "";
        const days = o.delivery_range?.max ?? o.delivery_time ?? 0;
        const priceStr = o.custom_price ?? o.price ?? "0";
        return {
          carrier: "MELHOR_ENVIO",
          service: `me-${o.id}`, // id estável do serviço (1=PAC, 2=SEDEX, ...)
          serviceName: company ? `${o.name} — ${company}` : o.name,
          priceCents: Math.round(parseFloat(priceStr) * 100),
          days,
        } satisfies ShippingQuote;
      })
      .filter((q) => q.priceCents > 0)
      // mais barato primeiro
      .sort((a, b) => a.priceCents - b.priceCents);
  }

  async track(_trackingCode: string): Promise<TrackingEvent[]> {
    // Rastreio automático exige o fluxo de compra de etiqueta do Melhor Envio.
    // Por ora, rastreio manual (código informado pelo admin no pedido).
    return [];
  }
}
