/**
 * Seed do banco — GATA FIT (moda feminina: fitness, praia e pijamas)
 *
 * Produtos, preços, cores e tamanhos representativos das três linhas da
 * loja. Imagens são placeholders elegantes na paleta da marca em
 * /public/products — troque pelas fotos reais no painel admin.
 *
 * Rodar com:  npm run db:seed   (ou npm run db:reset para recriar tudo)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------- imagens

const PRODUCTS_DIR = path.join(process.cwd(), "public", "products");

/** Placeholder editorial na paleta rosé/nude da marca (troque por foto real). */
function makeSvg(name: string, variant: number): string {
  const short = (name.length > 34 ? name.slice(0, 31) + "..." : name).toUpperCase();
  const [c1, c2] =
    variant === 0 ? ["#f4e6e9", "#e6cdd3"] : ["#f1e8e4", "#e2d0cd"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="720" height="960" fill="url(#g)"/>
  <rect x="44" y="44" width="632" height="872" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5"/>
  <text x="360" y="466" font-size="52" letter-spacing="16" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" fill="#7a545e" font-weight="500">GATA FIT</text>
  <text x="360" y="512" font-size="17" letter-spacing="4" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" fill="#7a545e" opacity="0.65">${short}</text>
</svg>`;
}

function writeImages(slug: string, name: string): string[] {
  const urls: string[] = [];
  for (const variant of [0, 1]) {
    const file = `${slug}-${variant + 1}.svg`;
    writeFileSync(path.join(PRODUCTS_DIR, file), makeSvg(name, variant), "utf8");
    urls.push(`/products/${file}`);
  }
  return urls;
}

// ---------------------------------------------------------------- dados

const SIZES = ["PP", "P", "M", "G", "GG"];

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  price: number; // centavos
  compareAt?: number;
  featured?: boolean;
  weightGrams?: number;
  dims?: [number, number, number];
  colors: string[];
  sizes?: string[]; // padrão: SIZES
}

/** Cruza tamanhos × cores gerando uma variação por combinação. */
function variants(p: SeedProduct) {
  const sizes = p.sizes ?? SIZES;
  const out: Array<{ size: string; color: string; stock: number }> = [];
  sizes.forEach((size, si) =>
    p.colors.forEach((color) => {
      // estoque com leve variação; PP/GG um pouco menores
      const base = 8 - Math.abs(si - 2);
      out.push({ size, color, stock: Math.max(2, base) });
    })
  );
  return out;
}

const CATEGORIES: Array<{
  name: string;
  slug: string;
  image: string;
  description: string;
  products: SeedProduct[];
}> = [
  {
    name: "Moda Fitness",
    slug: "moda-fitness",
    image: "🏋️‍♀️",
    description: "Leggings, tops e conjuntos com modelagem que valoriza o corpo",
    products: [
      {
        name: "Conjunto Fitness Sculpt",
        slug: "conjunto-fitness-sculpt",
        description:
          "Conjunto top + legging em tecido sculpt de alta compressão que modela e não marca.\n\n• Cintura alta com efeito \"barriga negativa\"\n• Tecido com proteção UV e toque seco\n• Costura reforçada, não fica transparente\n• Top com bojo removível",
        price: 23990,
        compareAt: 28990,
        featured: true,
        weightGrams: 400,
        dims: [30, 24, 5],
        colors: ["Preto", "Rosé", "Verde Militar", "Marinho"],
      },
      {
        name: "Legging Sculpt Cintura Alta",
        slug: "legging-sculpt-cintura-alta",
        description:
          "A legging que veste como uma segunda pele. Cintura alta modeladora e tecido que não fica transparente no agachamento.\n\n• Efeito modelador na cintura e no bumbum\n• Tecido sculpt de alta compressão\n• Proteção UV50+\n• Bolso lateral discreto",
        price: 14990,
        compareAt: 17990,
        featured: true,
        weightGrams: 250,
        dims: [28, 22, 4],
        colors: ["Preto", "Vinho", "Nude", "Verde Militar"],
      },
      {
        name: "Top Fitness com Bojo",
        slug: "top-fitness-com-bojo",
        description:
          "Top de sustentação média com bojo removível — do treino ao dia a dia.\n\n• Alças ajustáveis\n• Bojo removível\n• Tecido respirável com toque seco",
        price: 8990,
        weightGrams: 180,
        dims: [24, 20, 3],
        colors: ["Preto", "Rosé", "Branco", "Marinho"],
      },
      {
        name: "Short Fitness Cintura Alta",
        slug: "short-fitness-cintura-alta",
        description:
          "Short de compressão cintura alta com forro — liberdade de movimento sem transparência.\n\n• Cintura alta modeladora\n• Tecido sculpt com forro\n• Ideal para treino e verão",
        price: 9990,
        weightGrams: 180,
        dims: [26, 20, 3],
        colors: ["Preto", "Nude", "Vinho"],
      },
      {
        name: "Macaquinho Fitness",
        slug: "macaquinho-fitness",
        description:
          "Macaquinho de compressão peça única que modela o corpo inteiro.\n\n• Efeito modelador da cintura ao bumbum\n• Bojo removível\n• Tecido sculpt com toque seco",
        price: 16990,
        compareAt: 19990,
        featured: true,
        weightGrams: 320,
        dims: [30, 24, 4],
        colors: ["Preto", "Verde Militar", "Vinho"],
      },
      {
        name: "Calça Legging Flare",
        slug: "calca-legging-flare",
        description:
          "A legging flare que alonga a silhueta — cintura alta e barra evasê.\n\n• Cintura alta modeladora\n• Caimento flare que valoriza as pernas\n• Tecido encorpado que não marca",
        price: 15990,
        weightGrams: 300,
        dims: [30, 24, 4],
        colors: ["Preto", "Marinho"],
      },
      {
        name: "Cropped Manga Longa Fitness",
        slug: "cropped-manga-longa-fitness",
        description:
          "Cropped manga longa com polegar — perfeito para sobrepor no treino.\n\n• Furo para o polegar\n• Tecido leve com proteção UV\n• Modelagem cropped",
        price: 10990,
        weightGrams: 200,
        dims: [26, 20, 3],
        colors: ["Preto", "Off-White", "Rosé"],
      },
    ],
  },
  {
    name: "Moda Praia",
    slug: "moda-praia",
    image: "👙",
    description: "Biquínis, maiôs e saídas para brilhar no verão",
    products: [
      {
        name: "Biquíni Cortininha Franzido",
        slug: "biquini-cortininha-franzido",
        description:
          "Biquíni cortininha com franzido que valoriza o busto e calcinha de amarrar regulável.\n\n• Top cortininha com bojo removível\n• Calcinha de amarrar (regula o caimento)\n• Tecido com proteção UV, secagem rápida",
        price: 15990,
        featured: true,
        weightGrams: 160,
        dims: [24, 18, 3],
        colors: ["Preto", "Vermelho", "Rosé", "Estampa Tropical"],
      },
      {
        name: "Biquíni Meia Taça",
        slug: "biquini-meia-taca",
        description:
          "Biquíni meia taça de sustentação com bojo — elegância e conforto.\n\n• Top meia taça com bojo\n• Alças ajustáveis\n• Calcinha de cintura média",
        price: 16990,
        weightGrams: 170,
        dims: [24, 18, 3],
        colors: ["Preto", "Off-White", "Vinho"],
      },
      {
        name: "Maiô Engana Mamãe",
        slug: "maio-engana-mamae",
        description:
          "Maiô engana-mamãe com recortes que afinam a silhueta — clássico e poderoso.\n\n• Recortes laterais modeladores\n• Bojo removível\n• Cavado que alonga as pernas",
        price: 19990,
        featured: true,
        weightGrams: 220,
        dims: [26, 20, 3],
        colors: ["Preto", "Marinho", "Vermelho"],
      },
      {
        name: "Saída de Praia Kaftan",
        slug: "saida-de-praia-kaftan",
        description:
          "Kaftan fluida em tecido leve — a saída de praia que também é look de fim de tarde.\n\n• Tecido leve e fresco\n• Modelagem ampla e fluida\n• Fica linda aberta ou amarrada",
        price: 13990,
        weightGrams: 250,
        dims: [30, 24, 3],
        colors: ["Off-White", "Preto", "Estampa Tropical"],
        sizes: ["Único"],
      },
      {
        name: "Body de Praia Cavado",
        slug: "body-de-praia-cavado",
        description:
          "Body cavado de alcinha — use na praia, na piscina ou com short de cintura alta.\n\n• Cavado que alonga as pernas\n• Bojo removível\n• Tecido de secagem rápida",
        price: 14990,
        weightGrams: 180,
        dims: [24, 18, 3],
        colors: ["Preto", "Nude"],
      },
      {
        name: "Conjunto de Praia Cropped + Short",
        slug: "conjunto-de-praia-cropped-short",
        description:
          "Conjunto de cropped + short em tecido canelado — combinação perfeita para o verão.\n\n• Cropped de alcinha canelado\n• Short de cintura alta combinando\n• Peças que também funcionam separadas",
        price: 17990,
        weightGrams: 300,
        dims: [28, 22, 4],
        colors: ["Off-White", "Verde Água", "Terracota"],
      },
    ],
  },
  {
    name: "Pijamas & Loungewear",
    slug: "pijamas-e-loungewear",
    image: "🌙",
    description: "Cetim, algodão e conforto para relaxar com estilo",
    products: [
      {
        name: "Pijama de Cetim",
        slug: "pijama-de-cetim",
        description:
          "Conjunto de blusa + short em cetim com toque de seda — o pijama que parece lingerie.\n\n• Cetim macio de alto brilho\n• Blusa de alcinha com detalhe em viés\n• Short de cintura confortável",
        price: 15990,
        featured: true,
        weightGrams: 250,
        dims: [28, 22, 3],
        colors: ["Vinho", "Preto", "Rosé", "Champagne"],
      },
      {
        name: "Camisola de Cetim",
        slug: "camisola-de-cetim",
        description:
          "Camisola curta de cetim com renda no decote — leveza e sensualidade.\n\n• Cetim com toque de seda\n• Detalhe em renda no decote\n• Alças reguláveis",
        price: 11990,
        weightGrams: 180,
        dims: [26, 20, 2],
        colors: ["Preto", "Champagne", "Vinho"],
      },
      {
        name: "Pijama Curto de Algodão",
        slug: "pijama-curto-de-algodao",
        description:
          "Short doll de algodão premium — o conforto de dormir na sua melhor versão.\n\n• Algodão penteado macio e respirável\n• Blusa + short\n• Modelagem confortável que não aperta",
        price: 10990,
        featured: true,
        weightGrams: 220,
        dims: [28, 22, 3],
        colors: ["Rosé", "Azul Serenity", "Off-White"],
      },
      {
        name: "Conjunto Pijama Longo",
        slug: "conjunto-pijama-longo",
        description:
          "Pijama de blusa manga longa + calça em malha leve — aconchego para as noites frias.\n\n• Malha leve e quentinha\n• Blusa manga longa + calça\n• Punhos ajustados",
        price: 14990,
        weightGrams: 380,
        dims: [30, 24, 4],
        colors: ["Marinho", "Vinho", "Cinza"],
      },
      {
        name: "Robe de Cetim",
        slug: "robe-de-cetim",
        description:
          "Robe de cetim com faixa na cintura — para os momentos de autocuidado.\n\n• Cetim fluido de alto brilho\n• Faixa que marca a cintura\n• Comprimento midi",
        price: 13990,
        weightGrams: 260,
        dims: [30, 24, 3],
        colors: ["Champagne", "Preto", "Vinho"],
      },
      {
        name: "Camisola Longa de Alcinha",
        slug: "camisola-longa-de-alcinha",
        description:
          "Camisola longa de cetim com fenda lateral — elegância para dormir ou receber.\n\n• Comprimento longo com fenda\n• Cetim macio\n• Alças reguláveis",
        price: 12990,
        weightGrams: 200,
        dims: [28, 22, 2],
        colors: ["Preto", "Off-White"],
      },
    ],
  },
];

// avaliações temáticas de moda
const REVIEW_POOL: Array<[number, string, string]> = [
  [5, "Caiu perfeito!", "A modelagem é maravilhosa, valorizou tudo. Tecido de qualidade e não fica transparente. Já quero em outra cor!"],
  [5, "Apaixonada", "Melhor compra que fiz! Veste super bem, o tecido é grosso e gostoso. Chegou rapidinho e bem embalado."],
  [4, "Muito boa", "Amei a peça, caimento ótimo. Só achei que a cor é levemente mais clara que na foto, mas ficou linda."],
  [5, "Recomendo demais", "Qualidade impecável, parece de loja de shopping. O acabamento é perfeito e valoriza o corpo."],
  [5, "Virei cliente", "Já é minha terceira compra. Nunca me decepciona — tecido premium e modelagem que abraça o corpo."],
  [4, "Gostei muito", "Produto lindo e bem feito. Segui a tabela de medidas e serviu certinho. Entrega poderia ser um pouco mais rápida."],
  [5, "Perfeita", "Ficou um arraso! O tecido não marca nada e a compressão é ótima. Super confortável."],
  [4, "Vale a pena", "Boa qualidade pelo preço. Caimento bonito, recomendo pegar o seu tamanho normal."],
];

async function main() {
  console.log("🌱 Iniciando seed — Gata Fit (moda feminina)...");
  mkdirSync(PRODUCTS_DIR, { recursive: true });

  // limpa tudo (ordem respeita FKs)
  await prisma.$transaction([
    // ERP (Fases 1–9) — limpar primeiro (referenciam usuário/pedido/produto/
    // fornecedor). Sem isso, CashSession (FK obrigatória → User) bloqueia a
    // limpeza de usuários. Filhos antes dos pais.
    prisma.cashMovement.deleteMany(),
    prisma.cashSession.deleteMany(),
    prisma.fiscalInvoice.deleteMany(),
    prisma.financialEntry.deleteMany(),
    prisma.financialAccount.deleteMany(),
    prisma.financialCategory.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.customerProfile.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.review.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.address.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.shippingRule.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ---------------- usuários ----------------
  const admin = await prisma.user.create({
    data: {
      name: "Administradora",
      email: "admin@loja.com",
      passwordHash: bcrypt.hashSync("admin123", 12),
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "Cliente Teste",
      email: "cliente@teste.com",
      passwordHash: bcrypt.hashSync("cliente123", 12),
      role: "CUSTOMER",
      phone: "(11) 98765-4321",
      emailVerified: new Date(),
      addresses: {
        create: {
          label: "Casa",
          recipient: "Cliente Teste",
          cep: "01310100",
          street: "Avenida Paulista",
          number: "1578",
          complement: "Ap 42",
          district: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          phone: "(11) 98765-4321",
          isDefault: true,
        },
      },
    },
  });

  const reviewers = await Promise.all(
    [
      ["Juliana Martins", "juliana@exemplo.com"],
      ["Camila Rocha", "camila@exemplo.com"],
      ["Beatriz Alves", "beatriz@exemplo.com"],
      ["Larissa Souza", "larissa@exemplo.com"],
    ].map(([name, email]) =>
      prisma.user.create({
        data: {
          name,
          email,
          passwordHash: bcrypt.hashSync("senha12345", 12),
          emailVerified: new Date(),
        },
      })
    )
  );

  // ---------------- categorias + produtos ----------------
  let productCount = 0;
  const allProducts: Array<{ id: string; name: string; priceCents: number; imageUrl: string; weightGrams: number }> = [];

  for (const [catIndex, cat] of CATEGORIES.entries()) {
    const category = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        image: cat.image,
        position: catIndex,
      },
    });

    for (const p of cat.products) {
      const imageUrls = writeImages(p.slug, p.name);
      const vs = variants(p);
      const product = await prisma.product.create({
        data: {
          name: p.name,
          slug: p.slug,
          description: p.description,
          priceCents: p.price,
          compareAtCents: p.compareAt ?? null,
          brand: "Gata Fit",
          sku: `GF-${String(++productCount).padStart(4, "0")}`,
          stock: 0, // controlado por variação
          featured: p.featured ?? false,
          weightGrams: p.weightGrams ?? 300,
          lengthCm: p.dims?.[0] ?? 28,
          widthCm: p.dims?.[1] ?? 22,
          heightCm: p.dims?.[2] ?? 4,
          categoryId: category.id,
          images: {
            create: imageUrls.map((url, i) => ({ url, alt: p.name, position: i })),
          },
          variants: {
            create: vs.map((v) => ({
              name: `${v.size} / ${v.color}`,
              size: v.size,
              color: v.color,
              stock: v.stock,
            })),
          },
        },
      });
      allProducts.push({
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        imageUrl: imageUrls[0],
        weightGrams: product.weightGrams,
      });
    }
  }

  // ---------------- avaliações ----------------
  for (const [i, product] of allProducts.entries()) {
    const numReviews = (i % 4) + 1;
    const chosen: number[] = [];
    for (let r = 0; r < numReviews; r++) {
      const reviewer = reviewers[(i + r) % reviewers.length];
      const [rating, title, comment] = REVIEW_POOL[(i * 3 + r * 5) % REVIEW_POOL.length];
      chosen.push(rating);
      await prisma.review.create({
        data: {
          productId: product.id,
          userId: reviewer.id,
          rating,
          title,
          comment,
          verified: r % 2 === 0,
          createdAt: new Date(Date.now() - (r + 2) * 3 * 864e5),
        },
      });
    }
    const avg = chosen.reduce((s, v) => s + v, 0) / chosen.length;
    await prisma.product.update({
      where: { id: product.id },
      data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: chosen.length },
    });
  }

  // ---------------- cupons ----------------
  await prisma.coupon.createMany({
    data: [
      {
        code: "BEMVINDA10",
        description: "10% de desconto na primeira compra",
        type: "PERCENT",
        percent: 10,
        perUserLimit: 1,
      },
      {
        code: "GATA20",
        description: "R$ 20 OFF em pedidos acima de R$ 150",
        type: "FIXED",
        valueCents: 2000,
        minOrderCents: 15000,
      },
      {
        code: "FRETEGRATIS",
        description: "Frete grátis em pedidos acima de R$ 250",
        type: "FREE_SHIPPING",
        minOrderCents: 25000,
      },
    ],
  });

  // ---------------- tabela de frete (fallback) ----------------
  const regions = [
    { name: "São Paulo", start: "01000000", end: "19999999", pacBase: 1490, sedexBase: 2490, pacDays: 4, sedexDays: 1 },
    { name: "Sudeste (RJ/ES/MG)", start: "20000000", end: "39999999", pacBase: 1890, sedexBase: 2990, pacDays: 5, sedexDays: 2 },
    { name: "Nordeste", start: "40000000", end: "65999999", pacBase: 2590, sedexBase: 4290, pacDays: 9, sedexDays: 4 },
    { name: "Norte/Centro-Oeste", start: "66000000", end: "79999999", pacBase: 2890, sedexBase: 4890, pacDays: 10, sedexDays: 5 },
    { name: "Sul", start: "80000000", end: "99999999", pacBase: 1990, sedexBase: 3290, pacDays: 6, sedexDays: 2 },
  ];
  const weightBands = [
    { min: 0, max: 1000, extra: 0, label: "até 1kg" },
    { min: 1001, max: 5000, extra: 1000, label: "1–5kg" },
    { min: 5001, max: 30000, extra: 3000, label: "5–30kg" },
  ];
  for (const region of regions) {
    for (const band of weightBands) {
      await prisma.shippingRule.createMany({
        data: [
          {
            name: `${region.name} — PAC ${band.label}`,
            service: "PAC",
            cepStart: region.start,
            cepEnd: region.end,
            minWeightGrams: band.min,
            maxWeightGrams: band.max,
            priceCents: region.pacBase + band.extra,
            days: region.pacDays,
          },
          {
            name: `${region.name} — SEDEX ${band.label}`,
            service: "SEDEX",
            cepStart: region.start,
            cepEnd: region.end,
            minWeightGrams: band.min,
            maxWeightGrams: band.max,
            priceCents: region.sedexBase + Math.round(band.extra * 1.5),
            days: region.sedexDays,
          },
        ],
      });
    }
  }

  // ---------------- pedidos de exemplo (dashboard) ----------------
  const orderStatuses = [
    "ENTREGUE", "ENTREGUE", "ENTREGUE", "ENVIADO", "ENVIADO",
    "PAGO", "PAGO", "PAGO", "EM_SEPARACAO", "AGUARDANDO_PAGAMENTO",
    "ENTREGUE", "PAGO", "CANCELADO", "ENTREGUE", "PAGO",
  ];
  for (const [i, status] of orderStatuses.entries()) {
    const daysAgo = Math.floor((i / orderStatuses.length) * 28) + 1;
    const createdAt = new Date(Date.now() - daysAgo * 864e5 - (i % 12) * 3600e3);
    const chosen = [
      allProducts[(i * 3) % allProducts.length],
      allProducts[(i * 7 + 2) % allProducts.length],
    ].filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx);

    const items = chosen.map((p, j) => ({
      productId: p.id,
      name: p.name,
      unitPriceCents: p.priceCents,
      quantity: (j + i) % 2 === 0 ? 1 : 2,
      imageUrl: p.imageUrl,
      weightGrams: p.weightGrams,
    }));
    const subtotal = items.reduce((s, it) => s + it.unitPriceCents * it.quantity, 0);
    const shipping = 1490 + (i % 3) * 500;
    const isPaid = !["AGUARDANDO_PAGAMENTO", "CANCELADO"].includes(status);

    await prisma.order.create({
      data: {
        number: `PED-2026-SEED${String(i + 1).padStart(2, "0")}`,
        userId: customer.id,
        status,
        subtotalCents: subtotal,
        discountCents: 0,
        shippingCents: shipping,
        totalCents: subtotal + shipping,
        shipRecipient: "Cliente Teste",
        shipCep: "01310100",
        shipStreet: "Avenida Paulista",
        shipNumber: "1578",
        shipComplement: "Ap 42",
        shipDistrict: "Bela Vista",
        shipCity: "São Paulo",
        shipState: "SP",
        shippingCarrier: "TABELA_INTERNA",
        shippingMethod: i % 2 === 0 ? "Envio Econômico (PAC)" : "Envio Expresso (SEDEX)",
        shippingDays: i % 2 === 0 ? 4 : 1,
        trackingCode: ["ENVIADO", "ENTREGUE"].includes(status)
          ? `AA1234${String(i).padStart(4, "0")}BR`
          : null,
        paymentMethod: isPaid ? ["pix", "credit_card", "ticket"][i % 3] : null,
        paidAt: isPaid ? new Date(createdAt.getTime() + 3600e3) : null,
        createdAt,
        items: { create: items },
        statusHistory: {
          create: [
            { status: "AGUARDANDO_PAGAMENTO", note: "Pedido criado", createdAt },
            ...(isPaid
              ? [{ status: "PAGO", note: "Pagamento aprovado", createdAt: new Date(createdAt.getTime() + 3600e3) }]
              : []),
            ...(status !== "AGUARDANDO_PAGAMENTO" && status !== "PAGO" && status !== "CANCELADO"
              ? [{ status, createdAt: new Date(createdAt.getTime() + 2 * 864e5) }]
              : []),
            ...(status === "CANCELADO"
              ? [{ status: "CANCELADO", note: "Pagamento não aprovado", createdAt: new Date(createdAt.getTime() + 864e5) }]
              : []),
          ],
        },
      },
    });
  }

  // wishlist de exemplo
  await prisma.wishlistItem.createMany({
    data: [0, 7, 13].map((i) => ({
      userId: customer.id,
      productId: allProducts[i % allProducts.length].id,
    })),
  });

  // financeiro (Fase 2): contas e categorias padrão — idempotente
  if ((await prisma.financialAccount.count()) === 0) {
    await prisma.financialAccount.createMany({
      data: [
        { name: "Caixa da loja", kind: "CAIXA" },
        { name: "Banco", kind: "BANCO" },
        { name: "Mercado Pago", kind: "GATEWAY" },
      ],
    });
  }
  if ((await prisma.financialCategory.count()) === 0) {
    await prisma.financialCategory.createMany({
      data: [
        { name: "Vendas", type: "INCOME" },
        { name: "Fornecedores", type: "EXPENSE" },
        { name: "Despesas", type: "EXPENSE" },
      ],
    });
  }

  console.log("✅ Seed concluído — Gata Fit!");
  console.log("   Admin:   admin@loja.com / admin123");
  console.log("   Cliente: cliente@teste.com / cliente123");
  console.log(`   ${allProducts.length} produtos, ${CATEGORIES.length} categorias, 3 cupons, 30 regras de frete, 15 pedidos`);
  console.log(`   Painel admin: http://localhost:3000/admin (login: ${admin.email})`);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
