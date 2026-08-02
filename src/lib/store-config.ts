/**
 * Configuração central da loja (identidade, contato, dados legais).
 * Preenchida por variáveis de ambiente para facilitar a publicação.
 * Usada no rodapé, páginas legais, botão de WhatsApp e SEO.
 */
export const storeConfig = {
  name: "Gata Fit",
  tagline: "Moda Feminina",
  /** Razão social (para páginas legais / rodapé) */
  legalName: process.env.STORE_LEGAL_NAME || "",
  cnpj: process.env.STORE_CNPJ || "",
  legalAddress: process.env.STORE_LEGAL_ADDRESS || "",
  contactEmail: process.env.STORE_CONTACT_EMAIL || "contato@usegatafit.com.br",
  /** Telefone do WhatsApp, só dígitos com DDI. Ex.: 5551999999999 */
  whatsapp: (process.env.STORE_WHATSAPP || "").replace(/\D/g, ""),
  instagram: "https://www.instagram.com/use_gatafit/",
  instagramHandle: "@use_gatafit",
  /** Endereço de retirada na loja (também usado no pedido) */
  pickupAddress: process.env.STORE_PICKUP_ADDRESS || "",
  /** URL pública do site (para SEO/sitemap/OG) */
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

/** Link do WhatsApp com mensagem pré-preenchida (ou null se não configurado). */
export function whatsappLink(message?: string): string | null {
  if (!storeConfig.whatsapp) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${storeConfig.whatsapp}${text}`;
}
