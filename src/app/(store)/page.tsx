import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/store/ProductCard";
import { toCardData, productCardInclude, getWishedIds } from "@/lib/products";

export const dynamic = "force-dynamic";

// imagem de destaque por categoria (placeholders gerados no seed)
const CATEGORY_PHOTOS: Record<string, string> = {
  "moda-fitness": "/products/conjunto-fitness-sculpt-1.svg",
  "moda-praia": "/products/biquini-cortininha-franzido-1.svg",
  "pijamas-e-loungewear": "/products/pijama-de-cetim-1.svg",
};

export default async function HomePage() {
  const [featured, newest, categories, wishedIds] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, featured: true },
      include: productCardInclude,
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      include: productCardInclude,
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      take: 4,
    }),
    getWishedIds(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* hero editorial */}
      <section className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            Moda Feminina
          </p>
          <h1 className="mt-5 font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            Vista a sua
            <br />
            melhor versão.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Moda fitness, praia e pijamas para mulheres que se cuidam. Peças com
            caimento perfeito, tecidos de qualidade e modelagem que valoriza cada
            curva.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link
              href="/produtos"
              className="flex h-12 items-center bg-zinc-900 px-8 text-xs font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Ver produtos
            </Link>
            <Link
              href="/produtos?ordenar=avaliacao"
              className="text-xs uppercase tracking-[0.14em] text-zinc-600 underline underline-offset-8 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Mais bem avaliados
            </Link>
          </div>
          <p className="mt-10 text-[11px] tracking-wide text-zinc-400">
            Frete para todo o Brasil · Pix, cartão em até 12× e boleto
          </p>
        </div>
        <div className="relative hidden aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-900 lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/products/conjunto-fitness-sculpt-1.svg"
            alt="Conjunto fitness — Gata Fit"
            className="size-full object-cover"
          />
        </div>
      </section>

      {/* categorias em mosaico */}
      <section className="mt-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/produtos?categoria=${cat.slug}`}
              className="group relative block aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-900"
            >
              {CATEGORY_PHOTOS[cat.slug] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={CATEGORY_PHOTOS[cat.slug]}
                  alt={cat.name}
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-4xl">{cat.image}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent" />
              <span className="absolute inset-x-0 bottom-5 text-center text-xs font-medium uppercase tracking-[0.22em] text-white">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* destaques */}
      {featured.length > 0 && (
        <section className="mt-20">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-900 dark:text-zinc-100">
              Destaques
            </h2>
            <Link
              href="/produtos"
              className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 underline-offset-8 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={toCardData(p, wishedIds)} />
            ))}
          </div>
        </section>
      )}

      {/* novidades */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-900 dark:text-zinc-100">
            Novidades
          </h2>
          <Link
            href="/produtos?ordenar=recentes"
            className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 underline-offset-8 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
          >
            Ver todas
          </Link>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {newest.map((p) => (
            <ProductCard key={p.id} product={toCardData(p, wishedIds)} />
          ))}
        </div>
      </section>

      {/* manifesto / benefícios */}
      <section className="mt-24 border-y border-zinc-200 dark:border-zinc-800">
        <div className="grid divide-y divide-zinc-200 dark:divide-zinc-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Caimento perfeito", text: "Modelagem que valoriza o corpo, do PP ao GG." },
            { title: "Entrega em todo o Brasil", text: "Enviamos para todo o país com rastreio." },
            { title: "Pagamento facilitado", text: "Pix, boleto e cartão de crédito em até 12×." },
          ].map((b) => (
            <div key={b.title} className="px-8 py-10 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em]">{b.title}</p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{b.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
