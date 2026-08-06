import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { productSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { generateProductSku, buildVariantSku } from "@/lib/sku";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** POST /api/admin/products — cria produto com imagens e variações */
export const POST = handler(async (req) => {
  const admin = await requirePermission("products.write");
  const body = productSchema.parse(await req.json());

  const slug = body.slug || slugify(body.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) throw new ApiError(409, `Já existe um produto com o slug "${slug}"`);

  // SKU: usa o informado ou gera automaticamente (GF-0001, GF-0002...)
  const sku = body.sku?.trim() || (await generateProductSku());

  const product = await prisma.product.create({
    data: {
      name: body.name,
      slug,
      description: body.description,
      priceCents: body.priceCents,
      compareAtCents: body.compareAtCents ?? null,
      sku,
      brand: body.brand || null,
      stock: body.stock,
      minStock: body.minStock ?? null,
      active: body.active,
      featured: body.featured,
      weightGrams: body.weightGrams,
      lengthCm: body.lengthCm,
      widthCm: body.widthCm,
      heightCm: body.heightCm,
      categoryId: body.categoryId,
      images: {
        create: body.images.map((img, i) => ({
          url: img.url,
          alt: img.alt || body.name,
          position: i,
        })),
      },
      variants: {
        create: body.variants.map((v, i) => ({
          name: v.name,
          size: v.size || null,
          color: v.color || null,
          // variação sem SKU herda do produto: GF-0001-P-PRETO
          sku: v.sku?.trim() || buildVariantSku(sku, i, v.size, v.color),
          priceCents: v.priceCents ?? null,
          stock: v.stock,
        })),
      },
    },
  });

  await audit({
    userId: admin.id,
    action: "product.create",
    entity: "Product",
    entityId: product.id,
    detail: { name: product.name },
    ip: getClientIp(req),
  });

  return NextResponse.json(product, { status: 201 });
});
