// ---------------------------------------------------------------
// Configuração do módulo de rastreamento (tráfego pago).
//
// IDs PÚBLICOS (vão para o navegador por natureza, como o pixel de
// qualquer site) — usam prefixo NEXT_PUBLIC_:
//   NEXT_PUBLIC_META_PIXEL_ID   ID do Pixel da Meta (Facebook/Instagram)
//   NEXT_PUBLIC_GA4_ID          ID de medição do Google Analytics 4 (G-XXXX)
//
// SEGREDO (só servidor, SEM NEXT_PUBLIC) — usado só no CAPI:
//   META_CAPI_ACCESS_TOKEN      token da API de Conversões da Meta
//
// Sem os IDs, o módulo fica DESLIGADO (no-op). O rastreamento no
// cliente só dispara após o consentimento do visitante (LGPD).
// ---------------------------------------------------------------

export const trackingConfig = {
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID || "",
};

/** Há algum rastreador configurado? (define se o banner/scripts aparecem) */
export const hasClientTracking = Boolean(trackingConfig.metaPixelId || trackingConfig.ga4Id);

export const CONSENT_COOKIE = "cookie_consent"; // "granted" | "denied"
