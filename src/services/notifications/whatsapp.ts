// =====================================================================
// NOTIFICAÇÕES POR WHATSAPP (envio automático)
// ---------------------------------------------------------------------
// Envio agnóstico de provedor: funciona com qualquer API REST que aceite
// { phone, message } com um token Bearer (Z-API, Evolution API, UltraMsg,
// WhatsApp Cloud API via proxy simples, etc.).
//
// Variáveis de ambiente (no serviço de hospedagem, NUNCA no código):
//   WHATSAPP_API_URL     endpoint que envia a mensagem (POST)
//   WHATSAPP_API_TOKEN   token/credencial (enviado como Bearer)
//   WHATSAPP_PHONE_FIELD (opcional) nome do campo do telefone (padrão "phone")
//   WHATSAPP_TEXT_FIELD  (opcional) nome do campo do texto   (padrão "message")
//   WHATSAPP_DDI         (opcional) DDI padrão para números sem código (padrão 55)
//
// Sem WHATSAPP_API_URL, o envio é apenas logado (modo dev) — nada quebra.
// O botão flutuante wa.me (click-to-chat) continua existindo à parte.
// =====================================================================

import { storeConfig } from "@/lib/store-config";

/** Há provedor de envio automático configurado? */
export function whatsappSenderEnabled(): boolean {
  return Boolean(process.env.WHATSAPP_API_URL);
}

/** Normaliza para o formato E.164 sem "+": DDI + DDD + número (só dígitos). */
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  const ddi = (process.env.WHATSAPP_DDI || "55").replace(/\D/g, "");
  // remove zeros à esquerda de operadora
  d = d.replace(/^0+/, "");
  // 10 ou 11 dígitos = número nacional sem DDI → prefixa o DDI
  if (d.length === 10 || d.length === 11) d = ddi + d;
  // aceita apenas números plausíveis (12 a 13 dígitos com DDI)
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

/**
 * Envia uma mensagem de WhatsApp. Nunca lança — falha vira log
 * (notificação não pode derrubar o fluxo de pedido). Retorna se enviou.
 */
export async function sendWhatsApp(phone: string | null | undefined, message: string): Promise<boolean> {
  const to = normalizePhone(phone);
  if (!to) {
    console.warn("[whatsapp] telefone inválido/ausente — pulado");
    return false;
  }
  if (!process.env.WHATSAPP_API_URL) {
    console.log(`\n[whatsapp:dev] Para: ${to}\n[whatsapp:dev] Mensagem:\n${message}\n`);
    return false;
  }

  const phoneField = process.env.WHATSAPP_PHONE_FIELD || "phone";
  const textField = process.env.WHATSAPP_TEXT_FIELD || "message";
  const body: Record<string, string> = { [phoneField]: to, [textField]: message };

  try {
    const res = await fetch(process.env.WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.WHATSAPP_API_TOKEN
          ? { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error(`[whatsapp] provedor respondeu HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] falha no envio:", err);
    return false;
  }
}

/** Link de rastreio público universal (aceita códigos de qualquer transportadora). */
export function trackingUrl(code: string | null | undefined): string | null {
  if (!code) return null;
  return `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(code.trim())}`;
}

// ------------------------- templates de mensagem ----------------------

export function whatsappShippedMessage(params: {
  customerName: string;
  orderNumber: string;
  company?: string | null;
  trackingCode?: string | null;
}): string {
  const first = params.customerName.split(" ")[0] || params.customerName;
  const linhas = [
    `Oi, ${first}! 💜 Seu pedido *${params.orderNumber}* da ${storeConfig.name} já está a caminho! 🚚`,
  ];
  if (params.company) linhas.push(`📦 Transportadora: ${params.company}`);
  if (params.trackingCode) {
    linhas.push(`🔎 Código de rastreio: *${params.trackingCode}*`);
    const url = trackingUrl(params.trackingCode);
    if (url) linhas.push(`Acompanhe a entrega aqui: ${url}`);
  }
  linhas.push("");
  linhas.push("Qualquer dúvida, é só chamar por aqui. Obrigada por comprar com a gente! 🐾");
  return linhas.join("\n");
}

export function whatsappDeliveredMessage(params: {
  customerName: string;
  orderNumber: string;
}): string {
  const first = params.customerName.split(" ")[0] || params.customerName;
  return [
    `Oi, ${first}! 💜 Seu pedido *${params.orderNumber}* da ${storeConfig.name} foi *entregue*! 🎉`,
    "",
    "Esperamos que você ame suas peças. 🥰",
    "Se puder, conta pra gente o que achou — sua avaliação ajuda demais!",
    "",
    "Um beijo da equipe. 🐾",
  ].join("\n");
}
