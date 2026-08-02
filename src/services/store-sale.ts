import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";
import { recordMovement } from "@/services/stock";
import { storeConfig } from "@/lib/store-config";

// ---------------------------------------------------------------
// Venda no balcão (PDV). Reaproveita o mesmo motor de baixa de
// estoque da venda online (reserva atômica + movimentação "SALE"),
// mas o pedido já nasce PAGO, sem frete (retirada na loja).
//
// Segurança: os preços vêm SEMPRE do banco — nunca do cliente.
// ---------------------------------------------------------------

const WALKIN_EMAIL = "consumidor-final@loja.interna";

export const STORE_PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};

/** Garante (e retorna) o usuário-sistema "Consumidor Final" das vendas de balcão. */
async function getWalkInCustomerId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: WALKIN_EMAIL },
    update: {},
    create: { email: WALKIN_EMAIL, name: "Consumidor Final", role: "CUSTOMER" },
    select: { id: true },
  });
  return user.id;
}

export interface StoreSaleItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export async function createStoreSale(params: {
  adminId: string;
  items: StoreSaleItemInput[];
  paymentMethod: string;
  discountCents?: number;
  amountReceivedCents?: number | null;
}) {
  const { items, paymentMethod } = params;
  if (items.length === 0) throw new ApiError(400, "Adicione ao menos um item.");

  // resolve cada item com PREÇO/ESTOQUE do banco (nunca confia no cliente)
  const resolved: Array<{
    productId: string;
    variantId: string | null;
    name: string;
    variantName: string | null;
    unitPriceCents: number;
    quantity: number;
    imageUrl: string | null;
    weightGrams: number;
  }> = [];

  for (const it of items) {
    const product = await prisma.product.findUnique({
      where: { id: it.productId },
      include: { images: { orderBy: { position: "asc" }, take: 1 } },
    });
    if (!product || !product.active) throw new ApiError(404, "Produto indisponível.");

    let unitPriceCents = product.priceCents;
    let variantName: string | null = null;

    if (it.variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: it.variantId } });
      if (!variant || variant.productId !== product.id || !variant.active)
        throw new ApiError(404, "Variação indisponível.");
      unitPriceCents = variant.priceCents ?? product.priceCents;
      variantName = variant.name;
    }

    resolved.push({
      productId: product.id,
      variantId: it.variantId ?? null,
      name: product.name,
      variantName,
      unitPriceCents,
      quantity: it.quantity,
      imageUrl: product.images[0]?.url ?? null,
      weightGrams: product.weightGrams,
    });
  }

  const subtotalCents = resolved.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const discountCents = Math.min(Math.max(0, params.discountCents ?? 0), subtotalCents);
  const totalCents = subtotalCents - discountCents;

  if (
    paymentMethod === "dinheiro" &&
    params.amountReceivedCents != null &&
    params.amountReceivedCents < totalCents
  ) {
    throw new ApiError(400, "Valor recebido é menor que o total da venda.");
  }

  const userId = await getWalkInCustomerId();

  const order = await prisma.$transaction(async (tx) => {
    // baixa de estoque atômica (mesma lógica da venda online)
    const movements: Array<{
      productId: string;
      variantId: string | null;
      delta: number;
      resulting: number;
    }> = [];

    for (const item of resolved) {
      if (item.variantId) {
        const upd = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (upd.count === 0)
          throw new ApiError(
            409,
            `Estoque insuficiente para "${item.name}${item.variantName ? ` (${item.variantName})` : ""}".`
          );
        const v = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true },
        });
        movements.push({ productId: item.productId, variantId: item.variantId, delta: -item.quantity, resulting: v?.stock ?? 0 });
      } else {
        const upd = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (upd.count === 0) throw new ApiError(409, `Estoque insuficiente para "${item.name}".`);
        const p = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true } });
        movements.push({ productId: item.productId, variantId: null, delta: -item.quantity, resulting: p?.stock ?? 0 });
      }
    }

    const created = await tx.order.create({
      data: {
        number: generateOrderNumber(),
        userId,
        channel: "LOJA",
        status: "PAGO",
        paidAt: new Date(),
        paymentMethod,
        amountReceivedCents:
          paymentMethod === "dinheiro" ? params.amountReceivedCents ?? null : null,
        subtotalCents,
        discountCents,
        shippingCents: 0,
        totalCents,
        // sem entrega — retirada no balcão
        shipRecipient: "Consumidor Final",
        shipCep: "",
        shipStreet: storeConfig.pickupAddress || "Retirada na loja",
        shipNumber: "-",
        shipDistrict: "-",
        shipCity: "-",
        shipState: "",
        shippingCarrier: "RETIRADA",
        shippingMethod: "Retirada na loja",
        items: {
          create: resolved.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            name: i.name,
            variantName: i.variantName,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
            imageUrl: i.imageUrl,
            weightGrams: i.weightGrams,
          })),
        },
        statusHistory: {
          create: {
            status: "PAGO",
            note: `Venda no balcão (${STORE_PAYMENT_LABELS[paymentMethod] ?? paymentMethod})`,
          },
        },
      },
      include: { items: true },
    });

    for (const m of movements) {
      await recordMovement(tx, {
        ...m,
        reason: "SALE",
        note: `Venda em loja — pedido ${created.number}`,
        userId: params.adminId,
        orderId: created.id,
      });
    }

    return created;
  });

  return order;
}
