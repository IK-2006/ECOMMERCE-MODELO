/**
 * Configuração do emissor fiscal (NFC-e / NF-e). A comunicação com a SEFAZ é
 * feita por um provedor (Focus NFe) que exige token + certificado digital A1
 * configurados NA CONTA DO PROVEDOR (nunca aqui). Sem credenciais, o módulo
 * opera em modo "não configurado": registra a intenção, mas não transmite.
 *
 * ⚠️ TRIBUTAÇÃO: os padrões abaixo são para uma loja de vestuário no
 * SIMPLES NACIONAL. Os códigos (CFOP, CSOSN, CST de PIS/COFINS, NCM) DEVEM
 * ser confirmados pelo contador da loja — cada item pode variar. Tudo é
 * parametrizável por variável de ambiente para ajuste sem mexer no código.
 */
export const fiscalConfig = {
  provider: process.env.FISCAL_PROVIDER || "focusnfe",
  token: process.env.FOCUS_NFE_TOKEN || "",
  // "homologacao" (testes, sem valor fiscal) | "producao" (valor fiscal real)
  environment: process.env.FISCAL_ENVIRONMENT || "homologacao",
  baseUrl: process.env.FOCUS_NFE_URL || "https://homologacao.focusnfe.com.br",
  cnpj: (process.env.STORE_CNPJ || "").replace(/\D/g, ""),

  // ---- Emitente ----
  regime: (process.env.FISCAL_REGIME || "simples").toLowerCase(), // simples | normal
  uf: (process.env.STORE_UF || "").toUpperCase(), // UF do emitente (define CFOP intra/inter na NF-e)
  naturezaOperacao: process.env.FISCAL_NATUREZA || "Venda de mercadoria",
  // Série (opcional — a Focus controla numeração por empresa; deixe vazio p/ auto)
  serieNfce: process.env.FISCAL_SERIE_NFCE || undefined,
  serieNfe: process.env.FISCAL_SERIE_NFE || undefined,

  // ---- Tributação padrão (Simples Nacional) — CONFIRMAR COM O CONTADOR ----
  cfopIntra: process.env.FISCAL_CFOP_INTRA || "5102", // venda dentro do estado
  cfopInter: process.env.FISCAL_CFOP_INTER || "6102", // venda para outro estado
  csosn: process.env.FISCAL_CSOSN || "102", // Simples: tributada sem permissão de crédito
  pisCst: process.env.FISCAL_PIS_CST || "49", // outras operações de saída
  cofinsCst: process.env.FISCAL_COFINS_CST || "49",
  ncmPadrao: (process.env.FISCAL_NCM_PADRAO || "62179000").replace(/\D/g, ""), // vestuário (fallback)
  unidadePadrao: process.env.FISCAL_UNIDADE || "UN",
};

/** Há credenciais do provedor fiscal + CNPJ da loja? */
export function isFiscalConfigured(): boolean {
  return Boolean(fiscalConfig.token && fiscalConfig.cnpj);
}

/** true se o regime é Simples Nacional (usa CSOSN em vez de CST de ICMS). */
export function isSimplesNacional(): boolean {
  return fiscalConfig.regime === "simples";
}
