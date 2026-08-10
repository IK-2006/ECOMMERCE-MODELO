import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { fiscalConfig, isFiscalConfigured } from "@/lib/fiscal-config";
import {
  buildNfcePayload,
  buildNfePayload,
  type FiscalOrder,
  type FiscalItem,
} from "@/lib/fiscal-payload";

// ---------------------------------------------------------------
// Emissão fiscal (NFC-e do balcão / NF-e de envio) via Focus NFe.
// O modelo FiscalInvoice já existia no schema; aqui entra o serviço +
// adaptador. Sem credenciais, opera em modo "não configurado" (registra
// a intenção, não transmite à SEFAZ).
//
// ⚠️ Para IR AO AR: token do provedor, certificado digital A1 na conta do
// provedor (nunca aqui), CNPJ/UF da loja e a tributação confirmada pelo
// contador (fiscalConfig). Ver FASE-6-FISCAL-DESIGN.md.
// ---------------------------------------------------------------

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];

export const FISCAL_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  AUTORIZADA: "Autorizada",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
  ERRO: "Erro",
};

export const FISCAL_TYPE_LABELS: Record<string, string> = {
  NFCE: "NFC-e (balcão)",
  NFE: "NF-e (envio)",
};

/** Notas fiscais de um pedido. */
export function invoicesForOrder(orderId: string) {
  return prisma.fiscalInvoice.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
}

/**
 * Emite (ou reenvia) uma nota fiscal para o pedido. Idempotente por
 * providerRef (`order:<id>:<tipo>`): repetir não duplica uma nota já autorizada.
 */
export async function emitFiscalInvoice(params: { orderId: string; type: "NFCE" | "NFE" }) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: true, user: { select: { cpf: true } } },
  });
  if (!order) throw new ApiError(404, "Pedido não encontrado");
  if (!PAID_STATUSES.includes(order.status))
    throw new ApiError(400, "Só é possível emitir nota de um pedido pago.");

  const providerRef = `order:${order.id}:${params.type}`;
  const existing = await prisma.fiscalInvoice.findUnique({ where: { providerRef } });
  // já autorizada/processando → não reemite (idempotência)
  if (existing && !["ERRO", "REJEITADA"].includes(existing.status)) return existing;

  const invoice = existing
    ? await prisma.fiscalInvoice.update({
        where: { id: existing.id },
        data: { status: "PROCESSANDO", error: null },
      })
    : await prisma.fiscalInvoice.create({
        data: {
          orderId: order.id,
          type: params.type,
          provider: fiscalConfig.provider,
          providerRef,
          status: "PROCESSANDO",
        },
      });

  // Sem credenciais: registra a intenção mas não transmite.
  if (!isFiscalConfigured()) {
    return prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "ERRO",
        error:
          "Emissor fiscal não configurado. Defina FOCUS_NFE_TOKEN e STORE_CNPJ e conclua o cadastro do certificado A1 e da tributação no provedor.",
      },
    });
  }

  // --- Provedor configurado: transmite via Focus NFe ---
  try {
    const result = await emitViaFocusNFe(order, order.items, params.type, providerRef);
    return applyResult(invoice.id, result);
  } catch (err) {
    return prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: { status: "ERRO", error: err instanceof Error ? err.message : "Falha ao emitir nota." },
    });
  }
}

/**
 * Consulta o status atual de uma nota no provedor e atualiza o registro.
 * Usado no polling (a Focus responde "processando" e autoriza de forma assíncrona).
 */
export async function refreshFiscalInvoice(invoiceId: string) {
  const inv = await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new ApiError(404, "Nota não encontrada");
  if (!inv.providerRef || !isFiscalConfigured()) return inv;
  if (["AUTORIZADA", "CANCELADA"].includes(inv.status)) return inv; // estados finais

  try {
    const result = await consultarFocusNFe(inv.type as "NFCE" | "NFE", inv.providerRef);
    return applyResult(inv.id, result);
  } catch (err) {
    return prisma.fiscalInvoice.update({
      where: { id: inv.id },
      data: { error: err instanceof Error ? err.message : "Falha ao consultar nota." },
    });
  }
}

interface EmitResult {
  status: string;
  number?: number | null;
  series?: string | null;
  accessKey?: string | null;
  protocol?: string | null;
  danfeUrl?: string | null;
  xmlUrl?: string | null;
  error?: string | null;
}

/** Persiste o resultado do provedor no registro da nota. */
function applyResult(invoiceId: string, result: EmitResult) {
  return prisma.fiscalInvoice.update({
    where: { id: invoiceId },
    data: {
      status: result.status,
      number: result.number ?? undefined,
      series: result.series ?? undefined,
      accessKey: result.accessKey ?? undefined,
      protocol: result.protocol ?? undefined,
      danfeUrl: result.danfeUrl ?? undefined,
      xmlUrl: result.xmlUrl ?? undefined,
      emittedAt: result.status === "AUTORIZADA" ? new Date() : undefined,
      error: result.status === "AUTORIZADA" ? null : result.error ?? undefined,
    },
  });
}

type OrderWithFiscal = Prisma.OrderGetPayload<{
  include: { items: true; user: { select: { cpf: true } } };
}>;
type OrderItemRow = OrderWithFiscal["items"][number];

/** Resolve NCM/origem/unidade de cada item a partir do produto. */
async function resolveFiscalItems(items: OrderItemRow[]): Promise<FiscalItem[]> {
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean) as string[])];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, ncm: true, origem: true, unidade: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));
  return items.map((it) => {
    const p = it.productId ? pmap.get(it.productId) : null;
    return {
      name: it.name,
      variantName: it.variantName,
      sku: p?.sku ?? null,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      ncm: p?.ncm || fiscalConfig.ncmPadrao,
      origem: p?.origem || "0",
      unidade: p?.unidade || fiscalConfig.unidadePadrao,
    };
  });
}

/** Monta o FiscalOrder a partir do pedido carregado (CPF: da nota ou do cliente). */
function toFiscalOrder(order: OrderWithFiscal): FiscalOrder {
  return {
    number: order.number,
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    paymentMethod: order.paymentMethod,
    fiscalCpf: order.fiscalCpf || order.user?.cpf || null,
    channel: order.channel,
    shipRecipient: order.shipRecipient,
    shipCep: order.shipCep,
    shipStreet: order.shipStreet,
    shipNumber: order.shipNumber,
    shipComplement: order.shipComplement,
    shipDistrict: order.shipDistrict,
    shipCity: order.shipCity,
    shipState: order.shipState,
    shipPhone: order.shipPhone,
  };
}

/**
 * Adaptador Focus NFe: monta o payload (com tributação) e transmite.
 * SÓ roda quando há credenciais (isFiscalConfigured).
 */
async function emitViaFocusNFe(
  order: OrderWithFiscal,
  items: OrderItemRow[],
  type: "NFCE" | "NFE",
  ref: string
): Promise<EmitResult> {
  const fiscalOrder = toFiscalOrder(order);
  const fiscalItems = await resolveFiscalItems(items);

  if (type === "NFE" && !fiscalOrder.fiscalCpf) {
    return { status: "ERRO", error: "NF-e exige o CPF do destinatário. Informe o CPF no pedido." };
  }

  const path = type === "NFCE" ? "/v2/nfce" : "/v2/nfe";
  const url = `${fiscalConfig.baseUrl}${path}?ref=${encodeURIComponent(ref)}`;
  const payload =
    type === "NFCE" ? buildNfcePayload(fiscalOrder, fiscalItems) : buildNfePayload(fiscalOrder, fiscalItems);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok && res.status >= 500) {
    return { status: "REJEITADA", error: (data.mensagem as string) || `Provedor retornou ${res.status}` };
  }
  return mapFocusData(data);
}

/** Consulta o status de uma nota já enviada (polling da autorização). */
async function consultarFocusNFe(type: "NFCE" | "NFE", ref: string): Promise<EmitResult> {
  const path = type === "NFCE" ? "/v2/nfce" : "/v2/nfe";
  const url = `${fiscalConfig.baseUrl}${path}/${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: { Authorization: basicAuth() } });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return mapFocusData(data);
}

function basicAuth(): string {
  return `Basic ${Buffer.from(`${fiscalConfig.token}:`).toString("base64")}`;
}

/** Traduz a resposta da Focus NFe para o nosso EmitResult. */
function mapFocusData(data: Record<string, unknown>): EmitResult {
  const providerStatus = String(data.status ?? "processando");
  const status =
    providerStatus === "autorizado"
      ? "AUTORIZADA"
      : providerStatus === "cancelado"
        ? "CANCELADA"
        : providerStatus === "erro_autorizacao" || providerStatus === "denegado"
          ? "REJEITADA"
          : "PROCESSANDO";
  return {
    status,
    number: data.numero ? Number(data.numero) : null,
    series: (data.serie as string) ?? null,
    accessKey: (data.chave_nfe as string) ?? null,
    protocol: (data.protocolo as string) ?? null,
    danfeUrl: (data.caminho_danfe as string) ?? null,
    xmlUrl: (data.caminho_xml_nota_fiscal as string) ?? null,
    error:
      (data.mensagem_sefaz as string) ||
      (data.mensagem as string) ||
      (Array.isArray(data.erros) ? JSON.stringify(data.erros) : null),
  };
}
