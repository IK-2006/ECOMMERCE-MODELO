import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { ProductCardData } from "@/components/store/ProductCard";
import type { Prisma } from "@prisma/client";

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: true;
    variants: true;
  };
}>;

/** Converte um produto do Prisma para o formato do ProductCard. */
export function toCardData(
  product: ProductWithRelations,
  wishedIds?: Set<string>
): ProductCardData {
  const activeVariants = product.variants.filter((v) => v.active);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    imageUrl: product.images[0]?.url ?? null,
    categoryName: product.category.name,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    stock:
      activeVariants.length > 0
        ? activeVariants.reduce((sum, v) => sum + v.stock, 0)
        : product.stock,
    hasVariants: activeVariants.length > 0,
    wished: wishedIds?.has(product.id) ?? false,
  };
}

export const productCardInclude = {
  category: true,
  images: { orderBy: { position: "asc" as const } },
  variants: true,
};

/** IDs dos produtos na wishlist do usuário logado (vazio se deslogado). */
export async function getWishedIds(): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });
  return new Set(items.map((i) => i.productId));
}
