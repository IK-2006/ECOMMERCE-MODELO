import type {
  ShippingPackage,
  ShippingProvider,
  ShippingQuote,
  TrackingEvent,
} from "./types";

// ---------------------------------------------------------------
// Integração com a API oficial dos Correios (CWS).
// Docs: https://cws.correios.com.br  (Gestão de APIs)
//
// Requer contrato ativo. Credenciais no .env:
//   CORREIOS_USUARIO        (usuário do Meu Correios)
//   CORREIOS_CODIGO_ACESSO  (código de acesso à API, gerado no CWS)
//   CORREIOS_CONTRATO       (número do contrato)
//   CORREIOS_AMBIENTE       ("producao" | "homologacao")
//   CORREIOS_CEP_ORIGEM     (CEP de origem das postagens)
// ---------------------------------------------------------------

const BASE_URLS = {
  producao: "https://api.correios.com.br",
  homologacao: "https://apihom.correios.com.br",
} as const;

// Códigos de serviço mais comuns em contratos (ajuste conforme seu contrato)
const SERVICE_CODES: Record<"PAC" | "SEDEX", string> = {
  PAC: "03298", // PAC CONTRATO AG
  SEDEX: "03220", // SEDEX CONTRATO AG
};

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function baseUrl() {
  const env = process.env.CORREIOS_AMBIENTE === "producao" ? "producao" : "homologacao";
  return BASE_URLS[env];
}

/** Autentica no CWS e cacheia o token (validade típica: 24h). */
async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const usuario = process.env.CORREIOS_USUARIO!;
  const codigoAcesso = process.env.CORREIOS_CODIGO_ACESSO!;
  const contrato = process.env.CORREIOS_CONTRATO!;

  const res = await fetch(`${baseUrl()}/token/v1/autentica/contrato`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${usuario}:${codigoAcesso}`).toString("base64")}`,
    },
    body: JSON.stringify({ numero: contrato }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Correios: falha na autenticação (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { token: string; expiraEm?: string };
  tokenCache = {
    token: data.token,
    expiresAt: data.expiraEm ? new Date(data.expiraEm).getTime() : Date.now() + 12 * 3600_000,
  };
  return data.token;
}

/** "12,34" -> 1234 centavos */
function parseBrlToCents(value: string): number {
  return Math.round(parseFloat(value.replace(/\./g, "").replace(",", ".")) * 100);
}

async function quoteService(
  service: "PAC" | "SEDEX",
  cepDestino: string,
  pkg: ShippingPackage,
  token: string
): Promise<ShippingQuote | null> {
  const code = SERVICE_CODES[service];
  const cepOrigem = (process.env.CORREIOS_CEP_ORIGEM ?? "01001000").replace(/\D/g, "");
  const headers = { Authorization: `Bearer ${token}` };

  const precoParams = new URLSearchParams({
    cepOrigem,
    cepDestino,
    psObjeto: String(Math.max(300, pkg.weightGrams)), // peso em gramas (mín. 300g)
    tpObjeto: "2", // pacote
    comprimento: String(Math.max(16, pkg.lengthCm)),
    largura: String(Math.max(11, pkg.widthCm)),
    altura: String(Math.max(2, pkg.heightCm)),
    vlDeclarado: (pkg.declaredValueCents / 100).toFixed(2),
  });

  const prazoParams = new URLSearchParams({ cepOrigem, cepDestino });

  const [precoRes, prazoRes] = await Promise.all([
    fetch(`${baseUrl()}/preco/v1/nacional/${code}?${precoParams}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`${baseUrl()}/prazo/v1/nacional/${code}?${prazoParams}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  if (!precoRes.ok || !prazoRes.ok) return null;

  const preco = (await precoRes.json()) as { pcFinal?: string; pcBase?: string };
  const prazo = (await prazoRes.json()) as { prazoEntrega?: number };
  const priceStr = preco.pcFinal ?? preco.pcBase;
  if (!priceStr || prazo.prazoEntrega == null) return null;

  return {
    carrier: "CORREIOS",
    service,
    serviceName: service === "PAC" ? "PAC — Correios" : "SEDEX — Correios",
    priceCents: parseBrlToCents(priceStr),
    days: prazo.prazoEntrega,
  };
}

export class CorreiosProvider implements ShippingProvider {
  readonly name = "CORREIOS";

  async quote(cepDestino: string, pkg: ShippingPackage): Promise<ShippingQuote[]> {
    const token = await getToken();
    const results = await Promise.allSettled([
      quoteService("PAC", cepDestino, pkg, token),
      quoteService("SEDEX", cepDestino, pkg, token),
    ]);
    return results
      .filter(
        (r): r is PromiseFulfilledResult<ShippingQuote | null> => r.status === "fulfilled"
      )
      .map((r) => r.value)
      .filter((q): q is ShippingQuote => q !== null);
  }

  async track(trackingCode: string): Promise<TrackingEvent[]> {
    const token = await getToken();
    const res = await fetch(
      `${baseUrl()}/srorastro/v1/objetos/${encodeURIComponent(trackingCode)}?resultado=T`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      objetos?: Array<{
        eventos?: Array<{
          dtHrCriado?: string;
          descricao?: string;
          unidade?: { endereco?: { cidade?: string; uf?: string } };
        }>;
      }>;
    };

    const eventos = data.objetos?.[0]?.eventos ?? [];
    return eventos.map((e) => ({
      date: e.dtHrCriado ?? "",
      status: e.descricao ?? "",
      location: e.unidade?.endereco
        ? `${e.unidade.endereco.cidade ?? ""}/${e.unidade.endereco.uf ?? ""}`
        : undefined,
    }));
  }
}
