import { prisma } from "@/lib/prisma";
import { storeConfig } from "@/lib/store-config";

export const dynamic = "force-dynamic";

// Feed de produtos (RSS 2.0 + namespace g:) lido pelo Gerenciador de
// Catálogo da Meta e pelo Google Merchant Center. Alimenta os anúncios
// dinâmicos / de catálogo (mostrar exatamente o produto que a pessoa viu).
// URL pública para cadastrar nas plataformas: /feed/produtos.xml

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reais(cents: number): string {
  return `${(cents / 100).toFixed(2)} BRL`;
}

export async function GET() {
  const base = storeConfig.url.replace(/\/$/, "");

  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { active: true }, select: { stock: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const items = products
    .map((p) => {
      const stock =
        p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
      const image = p.images[0]?.url ?? "";
      const imageUrl = image.startsWith("http") ? image : `${base}${image}`;
      const desc = (p.description || p.name).replace(/\s+/g, " ").trim().slice(0, 4900);

      return [
        "    <item>",
        // g:id = id do produto (mesmo id usado nos eventos Pixel/CAPI →
        // garante o "match" no catálogo). O SKU vai como g:mpn.
        `      <g:id>${xmlEscape(p.id)}</g:id>`,
        p.sku ? `      <g:mpn>${xmlEscape(p.sku)}</g:mpn>` : "",
        `      <g:title>${xmlEscape(p.name)}</g:title>`,
        `      <g:description>${xmlEscape(desc)}</g:description>`,
        `      <g:link>${base}/produto/${p.slug}</g:link>`,
        image ? `      <g:image_link>${xmlEscape(imageUrl)}</g:image_link>` : "",
        `      <g:price>${reais(p.priceCents)}</g:price>`,
        p.compareAtCents && p.compareAtCents > p.priceCents
          ? `      <g:sale_price>${reais(p.priceCents)}</g:sale_price>`
          : "",
        `      <g:availability>${stock > 0 ? "in stock" : "out of stock"}</g:availability>`,
        `      <g:condition>new</g:condition>`,
        p.brand ? `      <g:brand>${xmlEscape(p.brand)}</g:brand>` : `      <g:brand>${xmlEscape(storeConfig.name)}</g:brand>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(storeConfig.name)}</title>
    <link>${base}</link>
    <description>Catálogo de produtos ${xmlEscape(storeConfig.name)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
