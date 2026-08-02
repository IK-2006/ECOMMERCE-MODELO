import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

const toReais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: "asc" } },
        variants: { where: { active: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 font-serif text-3xl font-medium tracking-tight">Editar produto</h1>
      <ProductForm
        categories={categories}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: toReais(product.priceCents),
          compareAt: product.compareAtCents ? toReais(product.compareAtCents) : "",
          sku: product.sku ?? "",
          brand: product.brand ?? "",
          stock: product.stock,
          active: product.active,
          featured: product.featured,
          weightGrams: product.weightGrams,
          lengthCm: product.lengthCm,
          widthCm: product.widthCm,
          heightCm: product.heightCm,
          categoryId: product.categoryId,
          images: product.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
          variants: product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            size: v.size ?? "",
            color: v.color ?? "",
            sku: v.sku ?? "",
            price: v.priceCents ? toReais(v.priceCents) : "",
            stock: v.stock,
          })),
        }}
      />
    </div>
  );
}
