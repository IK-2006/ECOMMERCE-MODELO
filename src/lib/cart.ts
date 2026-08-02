import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const CART_COOKIE = "cart_id";

// Itens sem join direto de produto: os dados de produto/variação são
// resolvidos em getCartDetailed, tolerando produtos removidos/desativados.
const cartInclude = {
  items: { orderBy: { createdAt: "asc" as const } },
};

/**
 * Resolve o carrinho atual:
 *  - usuário logado  -> carrinho vinculado ao userId (mescla o anônimo, se houver)
 *  - visitante       -> carrinho identificado pelo cookie `cart_id`
 * Retorna null se não existir (use ensureCart para criar).
 */
export async function getCart() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const anonId = cookieStore.get(CART_COOKIE)?.value ?? null;

  if (user) {
    let userCart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: cartInclude,
    });

    // Mescla carrinho anônimo (criado antes do login) no do usuário
    if (anonId && anonId !== userCart?.id) {
      const anonCart = await prisma.cart.findUnique({
        where: { id: anonId },
        include: { items: true },
      });
      if (anonCart && !anonCart.userId && anonCart.items.length > 0) {
        if (!userCart) {
          await prisma.cart.update({ where: { id: anonCart.id }, data: { userId: user.id } });
        } else {
          for (const item of anonCart.items) {
            const existing = userCart.items.find(
              (i) => i.productId === item.productId && i.variantId === item.variantId
            );
            if (existing) {
              await prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity: Math.min(99, existing.quantity + item.quantity) },
              });
            } else {
              await prisma.cartItem.create({
                data: {
                  cartId: userCart.id,
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                },
              });
            }
          }
          await prisma.cart.delete({ where: { id: anonCart.id } });
        }
        userCart = await prisma.cart.findUnique({
          where: { userId: user.id },
          include: cartInclude,
        });
      }
    }
    return userCart;
  }

  if (!anonId) return null;
  const cart = await prisma.cart.findUnique({ where: { id: anonId }, include: cartInclude });
  // cookie apontando para carrinho de outro usuário -> ignora
  if (cart?.userId) return null;
  return cart;
}

/** Garante que exista um carrinho e grava o cookie para visitantes. */
export async function ensureCart() {
  const existing = await getCart();
  if (existing) return existing;

  const user = await getCurrentUser();
  const cart = await prisma.cart.create({
    data: { userId: user?.id ?? null },
    include: cartInclude,
  });

  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90, // 90 dias
    path: "/",
  });
  return cart;
}

export interface CartItemDetailed {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  slug: string;
  variantName: string | null;
  unitPriceCents: number;
  imageUrl: string | null;
  stock: number;
  weightGrams: number;
}

export interface CartDetailed {
  id: string;
  items: CartItemDetailed[];
  subtotalCents: number;
  totalQuantity: number;
}

/** Carrinho com dados de produto/variação resolvidos e preços atuais. */
export async function getCartDetailed(): Promise<CartDetailed | null> {
  const cart = await getCart();
  if (!cart) return null;

  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items: CartItemDetailed[] = [];
  for (const item of cart.items) {
    const product = byId.get(item.productId);
    if (!product || !product.active) continue; // produto removido/desativado
    const variant = item.variantId
      ? product.variants.find((v) => v.id === item.variantId)
      : null;
    if (item.variantId && !variant) continue;

    items.push({
      id: item.id,
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity: item.quantity,
      name: product.name,
      slug: product.slug,
      variantName: variant?.name ?? null,
      unitPriceCents: variant?.priceCents ?? product.priceCents,
      imageUrl: product.images[0]?.url ?? null,
      stock: variant ? variant.stock : product.stock,
      weightGrams: product.weightGrams,
    });
  }

  return {
    id: cart.id,
    items,
    subtotalCents: items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}
