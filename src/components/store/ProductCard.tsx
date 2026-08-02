import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { RatingStars } from "./RatingStars";
import { WishlistButton } from "./WishlistButton";

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
  categoryName: string;
  ratingAvg: number;
  ratingCount: number;
  stock: number;
  hasVariants: boolean;
  wished?: boolean;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const discount =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round(100 - (product.priceCents / product.compareAtCents) * 100)
      : null;
  const soldOut = product.stock <= 0 && !product.hasVariants;

  return (
    <div className="group relative">
      <Link
        href={`/produto/${product.slug}`}
        className="relative block aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-900"
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-4xl text-zinc-300">💎</div>
        )}
        {discount && (
          <span className="absolute left-0 top-3 bg-white/95 px-2.5 py-1 text-[10px] font-medium tracking-[0.15em] text-zinc-900 dark:bg-zinc-950/90 dark:text-zinc-100">
            −{discount}%
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-zinc-950/80 py-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white">
            Esgotado
          </span>
        )}
      </Link>

      <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-lg:opacity-100">
        <WishlistButton productId={product.id} initialWished={product.wished ?? false} />
      </div>

      <div className="space-y-1.5 pt-3">
        <span className="block text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          {product.categoryName}
        </span>
        <Link
          href={`/produto/${product.slug}`}
          className="block text-sm leading-snug text-zinc-900 transition-colors hover:text-accent dark:text-zinc-100"
        >
          {product.name}
        </Link>
        {product.ratingCount > 0 && (
          <RatingStars value={product.ratingAvg} count={product.ratingCount} />
        )}
        <p className="flex items-baseline gap-2 pt-0.5">
          <span className="text-sm font-medium">{formatCurrency(product.priceCents)}</span>
          {discount && (
            <span className="text-xs text-zinc-400 line-through">
              {formatCurrency(product.compareAtCents!)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
