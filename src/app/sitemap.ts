import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { storeConfig } from "@/lib/store-config";

export const dynamic = "force-dynamic";

/** Sitemap dinâmico: páginas fixas + produtos e categorias ativos. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = storeConfig.url.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/produtos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/trocas-e-devolucoes`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/politica-de-privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/termos-de-uso`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.category.findMany({
        where: { active: true },
        select: { slug: true },
      }),
    ]);

    const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${base}/produto/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${base}/produtos?categoria=${c.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
