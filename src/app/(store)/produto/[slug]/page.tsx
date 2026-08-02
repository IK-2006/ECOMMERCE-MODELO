import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProductGallery } from "@/components/store/ProductGallery";
import { PurchasePanel } from "@/components/store/PurchasePanel";
import { TrackView } from "@/components/tracking/TrackView";
import { ShippingCalculator } from "@/components/store/ShippingCalculator";
import { ReviewSection } from "@/components/store/ReviewSection";
import { WishlistButton } from "@/components/store/WishlistButton";
import { ProductCard } from "@/components/store/ProductCard";
import { RatingStars } from "@/components/store/RatingStars";
import { toCardData, productCardInclude, getWishedIds } from "@/lib/products";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** SEO / Open Graph por produto (título, descrição e imagem para compartilhar). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { images: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!product) return { title: "Produto não encontrado" };

  const description =
    `${product.name} — ${formatCurrency(product.priceCents)}. ` +
    product.description.replace(/\s+/g, " ").slice(0, 140);
  const image = product.images[0]?.url;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { where: { active: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!product || !product.active) notFound();

  const user = await getCurrentUser();
  const [related, wishedIds] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, categoryId: product.categoryId, id: { not: product.id } },
      include: productCardInclude,
      take: 4,
    }),
    getWishedIds(),
  ]);

  const alreadyReviewed = user
    ? product.reviews.some((r) => r.userId === user.id)
    : false;

  const discount =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round(100 - (product.priceCents / product.compareAtCents) * 100)
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <TrackView id={product.id} name={product.name} priceReais={product.priceCents / 100} />
      {/* breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
        <Link href="/" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">Início</Link>
        <span className="text-zinc-300">/</span>
        <Link
          href={`/produtos?categoria=${product.category.slug}`}
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {product.category.name}
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="truncate text-zinc-700 dark:text-zinc-300">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          name={product.name}
        />

        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              {product.brand && (
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">{product.brand}</p>
              )}
              <h1 className="mt-2 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                {product.name}
              </h1>
              <div className="mt-2 flex items-center gap-3">
                {product.ratingCount > 0 ? (
                  <RatingStars value={product.ratingAvg} count={product.ratingCount} size="md" />
                ) : (
                  <span className="text-sm text-zinc-400">Sem avaliações ainda</span>
                )}
                {product.sku && (
                  <span className="text-xs text-zinc-400">SKU: {product.sku}</span>
                )}
              </div>
            </div>
            <WishlistButton productId={product.id} initialWished={wishedIds.has(product.id)} large />
          </div>

          {discount && (
            <p className="mt-4 text-sm">
              <span className="text-zinc-400 line-through">
                {formatCurrency(product.compareAtCents!)}
              </span>{" "}
              <span className="font-semibold text-accent">-{discount}% OFF</span>
            </p>
          )}

          <div className="mt-4">
            <PurchasePanel
              productId={product.id}
              productName={product.name}
              basePriceCents={product.priceCents}
              baseStock={product.stock}
              variants={product.variants.map((v) => ({
                id: v.id,
                name: v.name,
                size: v.size,
                color: v.color,
                priceCents: v.priceCents,
                stock: v.stock,
              }))}
            />
          </div>

          <div className="mt-6">
            <ShippingCalculator productId={product.id} />
          </div>
        </div>
      </div>

      {/* descrição */}
      <section className="mt-20 max-w-3xl border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Descrição</h2>
        <div className="mt-5 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {product.description}
        </div>
      </section>

      <ReviewSection
        productId={product.id}
        ratingAvg={product.ratingAvg}
        ratingCount={product.ratingCount}
        alreadyReviewed={alreadyReviewed}
        reviews={product.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          verified: r.verified,
          createdAt: r.createdAt.toISOString(),
          userName: r.user.name,
        }))}
      />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Você também pode gostar</h2>
          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={toCardData(p, wishedIds)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
