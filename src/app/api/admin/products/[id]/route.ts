import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { productSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { generateProductSku, buildVariantSku } from "@/lib/sku";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/products/[id] — atualiza produto (substitui imagens/variações) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("products.write");
  const { id } = await ctx.params;
  const body = productSchema.parse(await req.json());

  const existing = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!existing) throw new ApiError(404, "Produto não encontrado");

  const slug = body.slug || slugify(body.name);
  const slugTaken = await prisma.product.findFirst({
    where: { slug, id: { not: id } },
  });
  if (slugTaken) throw new ApiError(409, `Já existe um produto com o slug "${slug}"`);

  // SKU: respeita o informado; se vier vazio, mantém o atual ou gera um novo
  const sku = body.sku?.trim() || existing.sku || (await generateProductSku());

  const product = await prisma.$transaction(async (tx) => {
    // imagens: substituição completa (ordem = posição)
    await tx.productImage.deleteMany({ where: { productId: id } });

    // variações: atualiza as que vieram com id, cria novas, desativa removidas
    // (não deleta para preservar histórico de pedidos/carrinho)
    const keepIds = body.variants.filter((v) => v.id).map((v) => v.id!);
    await tx.productVariant.updateMany({
      where: { productId: id, id: { notIn: keepIds } },
      data: { active: false },
    });
    for (const [i, v] of body.variants.entries()) {
      const data = {
        name: v.name,
        size: v.size || null,
        color: v.color || null,
        // variação sem SKU herda do produto (GF-0001-P-PRETO)
        sku: v.sku?.trim() || buildVariantSku(sku, i, v.size, v.color),
        barcode: v.barcode?.trim() || null,
        priceCents: v.priceCents ?? null,
        stock: v.stock,
        active: true,
      };
      if (v.id) {
        await tx.productVariant.update({ where: { id: v.id }, data });
      } else {
        await tx.productVariant.create({ data: { ...data, productId: id } });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        description: body.description,
        priceCents: body.priceCents,
        compareAtCents: body.compareAtCents ?? null,
        sku,
        barcode: body.barcode?.trim() || null,
        brand: body.brand || null,
        ncm: body.ncm?.trim() || null,
        cest: body.cest?.trim() || null,
        origem: body.origem?.trim() || "0",
        unidade: body.unidade?.trim() || "UN",
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
      },
    });
  });

  await audit({
    userId: admin.id,
    action: "product.update",
    entity: "Product",
    entityId: id,
    detail: { name: product.name },
    ip: getClientIp(req),
  });

  return NextResponse.json(product);
});

/** DELETE /api/admin/products/[id] — desativa (soft) ou exclui se nunca vendido */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requirePermission("products.write");
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, "Produto não encontrado");

  const sold = await prisma.orderItem.count({ where: { productId: id } });
  if (sold > 0) {
    // produto com histórico de vendas: apenas desativa
    await prisma.product.update({ where: { id }, data: { active: false } });
    await audit({
      userId: admin.id,
      action: "product.deactivate",
      entity: "Product",
      entityId: id,
      ip: getClientIp(req),
    });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.product.delete({ where: { id } });
  await audit({
    userId: admin.id,
    action: "product.delete",
    entity: "Product",
    entityId: id,
    detail: { name: product.name },
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true, deleted: true });
});
