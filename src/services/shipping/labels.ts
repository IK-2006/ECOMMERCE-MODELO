// =====================================================================
// ORQUESTRAÇÃO DE ETIQUETAS + RASTREIO (regra de negócio)
// ---------------------------------------------------------------------
// Junta a camada de API do Melhor Envio (melhorenvio-labels.ts) ao
// banco e ao ciclo de status do pedido:
//   - generateLabelForOrder: carrinho → checkout → gerar → imprimir →
//     rastreio, persistindo tudo e marcando o pedido como ENVIADO
//     (o que dispara e-mail + WhatsApp de "Pedido enviado").
//   - refreshTracking: consulta o status atual; ao acusar entrega,
//     marca ENTREGUE (dispara "Pedido entregue").
//   - refreshAllActiveTracking: usado pelo cron de sincronização.
//
// Segurança/robustez:
//   - o id da etiqueta (shippingLabelId) é gravado logo após o checkout;
//     assim uma nova tentativa (retry) RETOMA de "gerar/imprimir" e
//     NÃO cobra o saldo de novo.
//   - toda falha grava shippingError + shippingStatus=ERRO para permitir
//     reprocessamento pela tela do pedido.
// =====================================================================

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { storeConfig } from "@/lib/store-config";
import { buildPackage } from "./index";
import { updateOrderStatus } from "@/services/orders";
import {
  addToCart,
  checkoutCart,
  generateLabels,
  getPrintUrl,
  getTrackingInfo,
  melhorEnvioLabelsEnabled,
  MelhorEnvioLabelError,
  parseMeServiceId,
  type CartPayload,
  type MeAddress,
} from "./melhorenvio-labels";

/** Converte erros do Melhor Envio em ApiError (status HTTP correto na rota). */
function asApiError(err: unknown): Error {
  if (err instanceof MelhorEnvioLabelError) return new ApiError(err.status, err.message);
  return err instanceof Error ? err : new Error("Falha desconhecida");
}

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Endereço de origem (remetente) a partir das variáveis MELHOR_ENVIO_FROM_*. */
function buildFromAddress(): MeAddress {
  const env = process.env;
  const from: MeAddress = {
    name: env.MELHOR_ENVIO_FROM_NAME || storeConfig.legalName || storeConfig.name,
    phone: onlyDigits(env.MELHOR_ENVIO_FROM_PHONE || storeConfig.whatsapp),
    email: env.MELHOR_ENVIO_FROM_EMAIL || storeConfig.contactEmail,
    document: onlyDigits(env.MELHOR_ENVIO_FROM_DOCUMENT || storeConfig.cnpj),
    address: env.MELHOR_ENVIO_FROM_ADDRESS || "",
    complement: env.MELHOR_ENVIO_FROM_COMPLEMENT || undefined,
    number: env.MELHOR_ENVIO_FROM_NUMBER || "",
    district: env.MELHOR_ENVIO_FROM_DISTRICT || "",
    city: env.MELHOR_ENVIO_FROM_CITY || "",
    state_abbr: (env.MELHOR_ENVIO_FROM_STATE || "").toUpperCase(),
    postal_code: onlyDigits(env.MELHOR_ENVIO_FROM_CEP || env.CORREIOS_CEP_ORIGEM),
  };

  const missing: string[] = [];
  if (!from.name) missing.push("MELHOR_ENVIO_FROM_NAME");
  if (!from.address) missing.push("MELHOR_ENVIO_FROM_ADDRESS");
  if (!from.number) missing.push("MELHOR_ENVIO_FROM_NUMBER");
  if (!from.district) missing.push("MELHOR_ENVIO_FROM_DISTRICT");
  if (!from.city) missing.push("MELHOR_ENVIO_FROM_CITY");
  if (!from.state_abbr) missing.push("MELHOR_ENVIO_FROM_STATE");
  if (from.postal_code.length !== 8) missing.push("MELHOR_ENVIO_FROM_CEP");
  if (!from.document) missing.push("MELHOR_ENVIO_FROM_DOCUMENT");
  if (missing.length) {
    throw new ApiError(
      422,
      `Endereço de origem incompleto para gerar a etiqueta. Configure no serviço ` +
        `de hospedagem: ${missing.join(", ")}.`,
    );
  }
  return from;
}

type OrderWithRelations = NonNullable<
  Awaited<ReturnType<typeof loadOrder>>
>;

function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
}

/** Monta o corpo do carrinho do Melhor Envio a partir do pedido. */
function buildCartPayload(order: OrderWithRelations, serviceId: number, from: MeAddress): CartPayload {
  const pkg = buildPackage(
    order.items.map((i) => ({
      quantity: i.quantity,
      weightGrams: i.weightGrams,
      unitPriceCents: i.unitPriceCents,
    })),
  );

  const to: MeAddress = {
    name: order.shipRecipient,
    phone: onlyDigits(order.shipPhone || order.user.phone),
    email: order.user.email,
    document: onlyDigits(order.user.cpf) || undefined,
    address: order.shipStreet,
    complement: order.shipComplement || undefined,
    number: order.shipNumber,
    district: order.shipDistrict,
    city: order.shipCity,
    state_abbr: (order.shipState || "").toUpperCase(),
    postal_code: onlyDigits(order.shipCep),
  };

  return {
    service: serviceId,
    from,
    to,
    products: order.items.map((i) => ({
      name: (i.variantName ? `${i.name} (${i.variantName})` : i.name).slice(0, 120),
      quantity: i.quantity,
      unitary_value: i.unitPriceCents / 100,
    })),
    volumes: [
      {
        height: Math.max(1, pkg.heightCm),
        width: Math.max(1, pkg.widthCm),
        length: Math.max(1, pkg.lengthCm),
        weight: Math.max(0.1, pkg.weightGrams / 1000),
      },
    ],
    options: {
      insurance_value: pkg.declaredValueCents / 100,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: true, // loja sem emissão de NF-e pela etiqueta
    },
  };
}

/** Transportadora efetiva a partir do rótulo do serviço ("PAC — Correios"). */
function carrierFromServiceName(name: string | null, fallback = "Correios"): string {
  if (!name) return fallback;
  const parts = name.split("—");
  return parts.length > 1 ? parts[parts.length - 1].trim() : fallback;
}

export interface LabelResult {
  ok: true;
  trackingCode: string | null;
  labelUrl: string;
  company: string;
}

/**
 * Gera (ou retoma) a etiqueta de um pedido do Melhor Envio.
 * Idempotente/resumível: se o pedido já tem shippingLabelId, pula
 * carrinho+checkout (que já cobraram o saldo) e retoma da geração.
 */
export async function generateLabelForOrder(orderId: string): Promise<LabelResult> {
  const order = await loadOrder(orderId);
  if (!order) throw new ApiError(404, "Pedido não encontrado");

  if (order.shippingCarrier !== "MELHOR_ENVIO") {
    throw new ApiError(
      400,
      "Este pedido não usa o Melhor Envio como transportadora — não é possível " +
        "gerar etiqueta por aqui (ex.: retirada na loja ou venda no balcão).",
    );
  }
  if (["CANCELADO", "REEMBOLSADO"].includes(order.status)) {
    throw new ApiError(400, "Pedido cancelado/reembolsado — etiqueta não pode ser gerada.");
  }
  if (!melhorEnvioLabelsEnabled()) {
    throw new ApiError(
      422,
      "Emissão de etiqueta indisponível: configure MELHOR_ENVIO_TOKEN (token " +
        "pessoal com escopos de etiqueta) no serviço de hospedagem.",
    );
  }
  const serviceId = parseMeServiceId(order.shippingServiceCode);
  if (!serviceId) {
    throw new ApiError(
      400,
      "Serviço de frete do pedido não identificado para o Melhor Envio. " +
        "Pedidos antigos podem não ter esse dado — refaça a compra ou informe o rastreio manualmente.",
    );
  }

  const from = buildFromAddress();

  try {
    let labelId = order.shippingLabelId;
    // Máquina de estados resumível — o retry nunca cobra o saldo de novo:
    //   (sem labelId) → NO_CARRINHO → PAGO → POSTADO/ENTREGUE
    // shippingStatus guarda o ponto MAIS AVANÇADO já alcançado; um erro
    // grava apenas shippingError (não regride o estado), então sabemos
    // com segurança se o checkout (cobrança) já aconteceu.
    const checkoutDone = ["PAGO", "POSTADO", "ENTREGUE"].includes(order.shippingStatus ?? "");

    // Passo 1 — carrinho (sem cobrança): só se ainda não há etiqueta
    if (!labelId) {
      const cart = await addToCart(buildCartPayload(order, serviceId, from));
      labelId = cart.id;
      await prisma.order.update({
        where: { id: orderId },
        data: {
          shippingLabelId: labelId,
          shippingProtocol: cart.protocol,
          shippingStatus: "NO_CARRINHO",
          shippingError: null,
        },
      });
    }

    // Passo 2 — checkout (COBRA o saldo): só se ainda não foi pago
    if (!checkoutDone) {
      await checkoutCart([labelId]);
      await prisma.order.update({
        where: { id: orderId },
        data: { shippingStatus: "PAGO", shippingError: null },
      });
    }

    // Passos 3, 4 e 5 (geração/impressão/rastreio são idempotentes no ME)
    await generateLabels([labelId]);
    const labelUrl = await getPrintUrl([labelId]);
    const tracking = (await getTrackingInfo([labelId]))[labelId];
    const trackingCode = tracking?.tracking || order.trackingCode || null;
    const company = carrierFromServiceName(order.shippingMethod);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingLabelUrl: labelUrl,
        trackingCode: trackingCode ?? undefined,
        shippingCompany: company,
        shippingStatus: "POSTADO",
        shippingPostedAt: order.shippingPostedAt ?? new Date(),
        shippingError: null,
      },
    });

    // status comercial → ENVIADO (dispara "Pedido enviado": e-mail + WhatsApp)
    if (order.status !== "ENVIADO") {
      await updateOrderStatus({
        orderId,
        status: "ENVIADO",
        note: "Etiqueta gerada no Melhor Envio",
        trackingCode: trackingCode,
      });
    }

    return { ok: true, trackingCode, labelUrl, company };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao gerar a etiqueta";
    // registra só o erro — NÃO regride shippingStatus (preserva se já pagou),
    // para o retry saber que o checkout não deve ser refeito.
    await prisma.order
      .update({ where: { id: orderId }, data: { shippingError: msg.slice(0, 500) } })
      .catch(() => {});
    throw asApiError(err);
  }
}

export interface TrackingResult {
  status: string | null;
  trackingCode: string | null;
  delivered: boolean;
}

/** Consulta o rastreio atual e, se entregue, marca o pedido como ENTREGUE. */
export async function refreshTracking(orderId: string): Promise<TrackingResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, "Pedido não encontrado");
  if (!order.shippingLabelId) {
    throw new ApiError(400, "Pedido sem etiqueta gerada — não há o que rastrear.");
  }

  let info;
  try {
    info = (await getTrackingInfo([order.shippingLabelId]))[order.shippingLabelId];
  } catch (err) {
    throw asApiError(err);
  }
  if (!info) {
    return { status: order.shippingStatus, trackingCode: order.trackingCode, delivered: false };
  }

  const delivered = info.status === "delivered" || Boolean(info.deliveredAt);
  const internal = delivered
    ? "ENTREGUE"
    : info.status === "posted"
      ? "POSTADO"
      : (order.shippingStatus ?? "POSTADO");

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shippingStatus: internal,
      trackingCode: info.tracking || order.trackingCode || undefined,
      shippingDeliveredAt: delivered
        ? info.deliveredAt
          ? new Date(info.deliveredAt)
          : (order.shippingDeliveredAt ?? new Date())
        : order.shippingDeliveredAt,
      shippingPostedAt:
        order.shippingPostedAt ?? (info.postedAt ? new Date(info.postedAt) : null),
    },
  });

  // status comercial → ENTREGUE (dispara "Pedido entregue": e-mail + WhatsApp)
  if (delivered && order.status !== "ENTREGUE") {
    await updateOrderStatus({
      orderId,
      status: "ENTREGUE",
      note: "Entrega confirmada pelo rastreio (Melhor Envio)",
    });
  }

  return { status: internal, trackingCode: info.tracking || order.trackingCode, delivered };
}

export interface CronResult {
  checked: number;
  delivered: number;
  errors: number;
}

/** Sincroniza o rastreio de todos os pedidos ENVIADO com etiqueta ativa. */
export async function refreshAllActiveTracking(): Promise<CronResult> {
  const orders = await prisma.order.findMany({
    where: { status: "ENVIADO", shippingLabelId: { not: null } },
    select: { id: true },
    take: 300,
  });

  let delivered = 0;
  let errors = 0;
  for (const o of orders) {
    try {
      const r = await refreshTracking(o.id);
      if (r.delivered) delivered++;
    } catch (err) {
      errors++;
      console.error("[tracking:cron] falha no pedido", o.id, err);
    }
  }
  return { checked: orders.length, delivered, errors };
}
