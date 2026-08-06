import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { fiscalConfig, isFiscalConfigured } from "@/lib/fiscal-config";
import type { Order, OrderItem } from "@prisma/client";

// ---------------------------------------------------------------
// Emissão fiscal (NFC-e do balcão / NF-e de envio) via provedor
// (Focus NFe). O modelo FiscalInvoice já existia no schema; aqui
// entra o serviço + adaptador. Sem credenciais, opera em modo
// "não configurado" (registra a intenção, não transmite à SEFAZ).
//
// ⚠️ Para IR AO AR são necessários: token do provedor, certificado
// digital A1 na conta do provedor, CNPJ/IE da loja e a tributação
// por produto (CFOP/CST/ICMS/PIS/COFINS). Ver FASE-6-FISCAL-DESIGN.md.
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
    include: { items: true },
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
    return prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: result.status,
        number: result.number ?? null,
        series: result.series ?? null,
        accessKey: result.accessKey ?? null,
        protocol: result.protocol ?? null,
        danfeUrl: result.danfeUrl ?? null,
        xmlUrl: result.xmlUrl ?? null,
        emittedAt: result.status === "AUTORIZADA" ? new Date() : null,
        error: result.error ?? null,
      },
    });
  } catch (err) {
    return prisma.fiscalInvoice.update({
      where: { id: invoice.id },
      data: { status: "ERRO", error: err instanceof Error ? err.message : "Falha ao emitir nota." },
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

/**
 * Adaptador Focus NFe. Monta o payload a partir do pedido e transmite.
 * SÓ roda quando há credenciais (isFiscalConfigured). O payload mínimo abaixo
 * precisa ser complementado com a tributação real (CFOP/CST/ICMS/PIS/COFINS)
 * por item — normalmente derivada de um regime tributário configurado.
 */
async function emitViaFocusNFe(
  order: Order,
  items: OrderItem[],
  type: "NFCE" | "NFE",
  ref: string
): Promise<EmitResult> {
  const path = type === "NFCE" ? "/v2/nfce" : "/v2/nfe";
  const url = `${fiscalConfig.baseUrl}${path}?ref=${encodeURIComponent(ref)}`;

  const payload = {
    cnpj_emitente: fiscalConfig.cnpj,
    // consumidor (opcional na NFC-e): CPF na nota se informado
    cpf_destinatario: order.fiscalCpf || undefined,
    valor_total: (order.totalCents / 100).toFixed(2),
    items: items.map((it, i) => ({
      numero_item: i + 1,
      descricao: it.variantName ? `${it.name} (${it.variantName})` : it.name,
      quantidade_comercial: it.quantity,
      valor_unitario_comercial: (it.unitPriceCents / 100).toFixed(2),
      // ⚠️ tributação real deve entrar aqui (ncm, cfop, icms_situacao_tributaria, etc.)
    })),
  };

  const auth = Buffer.from(`${fiscalConfig.token}:`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return { status: "REJEITADA", error: (data.mensagem as string) || `Provedor retornou ${res.status}` };
  }

  const providerStatus = String(data.status ?? "processando");
  const mapped =
    providerStatus === "autorizado"
      ? "AUTORIZADA"
      : providerStatus === "erro_autorizacao" || providerStatus === "denegado"
        ? "REJEITADA"
        : "PROCESSANDO";

  return {
    status: mapped,
    number: data.numero ? Number(data.numero) : null,
    series: (data.serie as string) ?? null,
    accessKey: (data.chave_nfe as string) ?? null,
    protocol: (data.protocolo as string) ?? null,
    danfeUrl: (data.caminho_danfe as string) ?? null,
    xmlUrl: (data.caminho_xml_nota_fiscal as string) ?? null,
    error: (data.mensagem_sefaz as string) ?? null,
  };
}
