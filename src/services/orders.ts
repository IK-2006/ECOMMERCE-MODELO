import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";
import {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendOrderShipped,
  sendOrderDelivered,
} from "@/lib/email";
import { recordMovement } from "@/services/stock";
import { trackPurchase } from "@/services/tracking/meta-capi";
import {
  sendWhatsApp,
  whatsappShippedMessage,
  whatsappDeliveredMessage,
} from "@/services/notifications/whatsapp";
import type { CartDetailed } from "@/lib/cart";
import type { CouponResult } from "@/services/coupons";

export interface ShippingSelection {
  carrier: string;
  service: string; // código estável do serviço (ex.: "me-1", "PAC", "retirada")
  serviceName: string; // rótulo legível gravado no pedido (admin/e-mail)
  priceCents: number;
  days: number;
}

export interface AddressSnapshot {
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  phone?: string | null;
}

/**
 * Cria o pedido numa transação:
 *  - revalida e DECREMENTA o estoque (reserva — evita overselling)
 *  - aplica cupom e incrementa seu contador de uso
 *  - grava snapshot de itens e endereço
 * Devolve o pedido criado. Envia e-mail de confirmação (não bloqueante).
 */
export async function createOrder(params: {
  userId: string;
  userEmail: string;
  userName: string;
  cart: CartDetailed;
  address: AddressSnapshot;
  shipping: ShippingSelection;
  coupon: CouponResult | null;
}) {
  const { cart, coupon, shipping, address } = params;
  if (cart.items.length === 0) throw new ApiError(400, "Carrinho vazio");

  const subtotalCents = cart.subtotalCents;
  const discountCents = coupon?.discountCents ?? 0;
  const shippingCents = coupon?.freeShipping ? 0 : shipping.priceCents;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  const order = await prisma.$transaction(async (tx) => {
    // Reserva de estoque com verificação atômica (updateMany + count).
    // Coleta o estoque resultante para registrar as movimentações de venda.
    const saleMovements: Array<{
      productId: string;
      variantId: string | null;
      delta: number;
      resulting: number;
    }> = [];

    for (const item of cart.items) {
      if (item.variantId) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0)
          throw new ApiError(409, `Estoque insuficiente para "${item.name} (${item.variantName})"`);
        const v = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true },
        });
        saleMovements.push({
          productId: item.productId,
          variantId: item.variantId,
          delta: -item.quantity,
          resulting: v?.stock ?? 0,
        });
      } else {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0)
          throw new ApiError(409, `Estoque insuficiente para "${item.name}"`);
        const p = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true },
        });
        saleMovements.push({
          productId: item.productId,
          variantId: null,
          delta: -item.quantity,
          resulting: p?.stock ?? 0,
        });
      }
    }

    if (coupon) {
      if (coupon.maxUses != null) {
        // incremento ATÔMICO: só sobe se ainda houver usos disponíveis.
        // Fecha a corrida entre checkouts simultâneos (validateCoupon roda
        // antes da transação e dois pedidos poderiam ultrapassar o limite).
        const bumped = await tx.coupon.updateMany({
          where: { id: coupon.couponId, usedCount: { lt: coupon.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (bumped.count === 0) throw new ApiError(409, "Este cupom atingiu o limite de usos");
      } else {
        await tx.coupon.update({
          where: { id: coupon.couponId },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    const created = await tx.order.create({
      data: {
        number: generateOrderNumber(),
        userId: params.userId,
        status: "AGUARDANDO_PAGAMENTO",
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        couponId: coupon?.couponId ?? null,
        couponCode: coupon?.code ?? null,
        shipRecipient: address.recipient,
        shipCep: address.cep,
        shipStreet: address.street,
        shipNumber: address.number,
        shipComplement: address.complement ?? null,
        shipDistrict: address.district,
        shipCity: address.city,
        shipState: address.state,
        shipPhone: address.phone ?? null,
        shippingCarrier: shipping.carrier,
        shippingMethod: shipping.serviceName || shipping.service,
        shippingDays: shipping.days,
        // código do serviço (ex.: "me-1") — usado depois para gerar a etiqueta
        shippingServiceCode: shipping.service || null,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            variantName: item.variantName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            weightGrams: item.weightGrams,
          })),
        },
        statusHistory: {
          create: { status: "AGUARDANDO_PAGAMENTO", note: "Pedido criado" },
        },
      },
      include: { items: true },
    });

    // registra as movimentações de venda (agora com o id do pedido)
    for (const m of saleMovements) {
      await recordMovement(tx, {
        ...m,
        reason: "SALE",
        note: `Venda — pedido ${created.number}`,
        orderId: created.id,
      });
    }

    // limpa o carrinho
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  void sendOrderConfirmation({
    to: params.userEmail,
    customerName: params.userName,
    orderNumber: order.number,
    totalCents: order.totalCents,
    items: order.items.map((i) => ({
      name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  });

  return order;
}

/** Devolve itens ao estoque (pedido cancelado/expirado) e registra o movimento. */
async function restoreStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
  orderNumber: string
) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.productId) continue;
    let resulting = 0;
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
      const v = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { stock: true },
      });
      resulting = v?.stock ?? 0;
    } else {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
      const p = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true },
      });
      resulting = p?.stock ?? 0;
    }
    await recordMovement(tx, {
      productId: item.productId,
      variantId: item.variantId,
      delta: item.quantity,
      resulting,
      reason: "CANCEL_RESTORE",
      note: `Devolução — pedido ${orderNumber} cancelado`,
      orderId,
    });
  }
}

/**
 * Atualiza o status de um pedido com histórico, efeitos colaterais
 * (estorno de estoque em cancelamento, paidAt em pagamento) e e-mail.
 * Idempotente: repetir o mesmo status não duplica efeitos.
 */
export async function updateOrderStatus(params: {
  orderId: string;
  status: string;
  note?: string | null;
  trackingCode?: string | null;
  paymentInfo?: { mpPaymentId?: string; paymentMethod?: string } | null;
}) {
  const { orderId, status } = params;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });
    if (!order) throw new ApiError(404, "Pedido não encontrado");

    const statusChanged = order.status !== status;

    // devolve estoque só na transição PARA cancelado/reembolsado
    if (statusChanged && (status === "CANCELADO" || status === "REEMBOLSADO")) {
      await restoreStock(tx, orderId, order.number);
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        trackingCode: params.trackingCode || order.trackingCode,
        paidAt: status === "PAGO" && !order.paidAt ? new Date() : order.paidAt,
        mpPaymentId: params.paymentInfo?.mpPaymentId ?? order.mpPaymentId,
        paymentMethod: params.paymentInfo?.paymentMethod ?? order.paymentMethod,
        ...(statusChanged && {
          statusHistory: { create: { status, note: params.note ?? null } },
        }),
      },
      include: { user: true },
    });

    return { updated, statusChanged };
  });

  if (result.statusChanged) {
    const u = result.updated;
    // telefone para WhatsApp: o da entrega tem prioridade; senão o do perfil
    const customerPhone = u.shipPhone || u.user.phone;

    // Notificações específicas de logística (e-mail rico + WhatsApp).
    // Centralizadas aqui para que valham qualquer que seja a origem da
    // transição (gerar etiqueta, cron de rastreio ou ajuste manual) — sem
    // duplicar com o e-mail genérico.
    if (status === "ENVIADO") {
      void sendOrderShipped({
        to: u.user.email,
        customerName: u.user.name,
        orderNumber: u.number,
        company: u.shippingCompany,
        trackingCode: u.trackingCode,
      });
      void sendWhatsApp(
        customerPhone,
        whatsappShippedMessage({
          customerName: u.user.name,
          orderNumber: u.number,
          company: u.shippingCompany,
          trackingCode: u.trackingCode,
        }),
      );
    } else if (status === "ENTREGUE") {
      void sendOrderDelivered({
        to: u.user.email,
        customerName: u.user.name,
        orderNumber: u.number,
      });
      void sendWhatsApp(
        customerPhone,
        whatsappDeliveredMessage({ customerName: u.user.name, orderNumber: u.number }),
      );
    } else {
      void sendOrderStatusUpdate({
        to: u.user.email,
        customerName: u.user.name,
        orderNumber: u.number,
        status,
        trackingCode: u.trackingCode,
      });
    }

    // Tráfego pago: dispara o evento de COMPRA (Meta CAPI, server-side)
    // quando o pagamento é confirmado. Só vendas ONLINE (o balcão/PDV
    // não passa por aqui). No-op se o módulo não estiver configurado.
    if (status === "PAGO" && result.updated.channel !== "LOJA") {
      void (async () => {
        const items = await prisma.orderItem.findMany({
          where: { orderId },
          select: { productId: true, quantity: true, unitPriceCents: true },
        });
        void trackPurchase({
          orderId,
          orderNumber: result.updated.number,
          totalCents: result.updated.totalCents,
          email: result.updated.user.email,
          phone: result.updated.user.phone,
          items,
        });
      })();
    }
  }

  return result.updated;
}
