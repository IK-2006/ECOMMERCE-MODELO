/**
 * Configuração do emissor fiscal (NFC-e / NF-e). A comunicação com a SEFAZ é
 * feita por um provedor (Focus NFe / Nuvem Fiscal) que exige token + certificado
 * digital A1 configurados na conta do provedor. Sem credenciais, o módulo opera
 * em modo "não configurado": registra a intenção de emissão, mas não transmite.
 */
export const fiscalConfig = {
  provider: process.env.FISCAL_PROVIDER || "focusnfe",
  token: process.env.FOCUS_NFE_TOKEN || "",
  // "homologacao" (testes) | "producao" (valor fiscal real)
  environment: process.env.FISCAL_ENVIRONMENT || "homologacao",
  baseUrl: process.env.FOCUS_NFE_URL || "https://api.focusnfe.com.br",
  cnpj: (process.env.STORE_CNPJ || "").replace(/\D/g, ""),
};

/** Há credenciais do provedor fiscal + CNPJ da loja? */
export function isFiscalConfigured(): boolean {
  return Boolean(fiscalConfig.token && fiscalConfig.cnpj);
}
