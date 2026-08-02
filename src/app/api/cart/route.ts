import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { ensureCart, getCartDetailed } from "@/lib/cart";
import { cartItemSchema, updateCartItemSchema } from "@/lib/validations";

/** GET /api/cart — carrinho atual (cria se não existir cookie) */
export const GET = handler(async () => {
  const cart = await getCartDetailed();
  return NextResponse.json(
    cart ?? { id: null, items: [], subtotalCents: 0, totalQuantity: 0 }
  );
});

/** POST /api/cart — adiciona item { productId, variantId?, quantity } */
export const POST = handler(async (req) => {
  const body = cartItemSchema.parse(await req.json());
  const cart = await ensureCart();

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    include: { variants: true },
  });
  if (!product || !product.active) throw new ApiError(404, "Produto não encontrado");

  const activeVariants = product.variants.filter((v) => v.active);
  let stock = product.stock;
  if (activeVariants.length > 0) {
    if (!body.variantId) throw new ApiError(400, "Selecione uma variação do produto");
    const variant = activeVariants.find((v) => v.id === body.variantId);
    if (!variant) throw new ApiError(404, "Variação não encontrada");
    stock = variant.stock;
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: body.productId,
      variantId: body.variantId ?? null,
    },
  });

  const newQuantity = (existing?.quantity ?? 0) + body.quantity;
  if (newQuantity > stock) {
    throw new ApiError(409, `Estoque insuficiente (disponível: ${stock})`);
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: Math.min(99, newQuantity) },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: body.productId,
        variantId: body.variantId ?? null,
        quantity: body.quantity,
      },
    });
  }

  return NextResponse.json(await getCartDetailed());
});

/** PATCH /api/cart — atualiza quantidade { itemId, quantity } (0 remove) */
export const PATCH = handler(async (req) => {
  const body = updateCartItemSchema.parse(await req.json());
  const cart = await ensureCart();

  const item = await prisma.cartItem.findFirst({
    where: { id: body.itemId, cartId: cart.id },
  });
  if (!item) throw new ApiError(404, "Item não encontrado no carrinho");

  if (body.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    // valida estoque atual
    let stock = 0;
    if (item.variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
      stock = variant?.stock ?? 0;
    } else {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      stock = product?.stock ?? 0;
    }
    if (body.quantity > stock) {
      throw new ApiError(409, `Estoque insuficiente (disponível: ${stock})`);
    }
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: body.quantity },
    });
  }

  return NextResponse.json(await getCartDetailed());
});

/** DELETE /api/cart — esvazia o carrinho */
export const DELETE = handler(async () => {
  const cart = await ensureCart();
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return NextResponse.json(await getCartDetailed());
});
