import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/store/ProductCard";
import { toCardData, productCardInclude, getWishedIds } from "@/lib/products";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produtos" };

const PER_PAGE = 12;

interface CatalogSearchParams {
  q?: string;
  categoria?: string;
  min?: string;
  max?: string;
  avaliacao?: string;
  ordenar?: string;
  pagina?: string;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10) || 1);
  const minReais = parseFloat(params.min ?? "") || null;
  const maxReais = parseFloat(params.max ?? "") || null;
  const minRating = parseInt(params.avaliacao ?? "", 10) || null;

  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(params.q && {
      OR: [
        { name: { contains: params.q } },
        { description: { contains: params.q } },
        { brand: { contains: params.q } },
      ],
    }),
    ...(params.categoria && { category: { slug: params.categoria } }),
    ...(minReais != null && { priceCents: { gte: Math.round(minReais * 100) } }),
    ...(maxReais != null && {
      priceCents: {
        ...(minReais != null ? { gte: Math.round(minReais * 100) } : {}),
        lte: Math.round(maxReais * 100),
      },
    }),
    ...(minRating != null && { ratingAvg: { gte: minRating } }),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    params.ordenar === "menor-preco"
      ? { priceCents: "asc" }
      : params.ordenar === "maior-preco"
        ? { priceCents: "desc" }
        : params.ordenar === "avaliacao"
          ? { ratingAvg: "desc" }
          : params.ordenar === "recentes"
            ? { createdAt: "desc" }
            : { featured: "desc" };

  const [products, total, categories, wishedIds] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productCardInclude,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    getWishedIds(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // monta querystring preservando filtros ao trocar de página/ordenação
  const buildQuery = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { ...params, ...overrides };
    const qs = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return qs ? `/produtos?${qs}` : "/produtos";
  };

  const activeCategory = categories.find((c) => c.slug === params.categoria);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            {params.q
              ? `Resultados para “${params.q}”`
              : activeCategory?.name ?? "Todos os produtos"}
          </h1>
          <p className="mt-2 text-xs tracking-wide text-zinc-400">
            {total} PEÇA{total === 1 ? "" : "S"}
          </p>
        </div>

        {/* ordenação — links discretos */}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {[
            ["relevancia", "Relevância"],
            ["recentes", "Novidades"],
            ["menor-preco", "Menor preço"],
            ["maior-preco", "Maior preço"],
            ["avaliacao", "Avaliação"],
          ].map(([key, label]) => {
            const active = (params.ordenar ?? "relevancia") === key;
            return (
              <Link
                key={key}
                href={buildQuery({ ordenar: key === "relevancia" ? undefined : key, pagina: undefined })}
                className={cn(
                  "text-[11px] uppercase tracking-[0.14em] underline-offset-8 transition-colors",
                  active
                    ? "text-zinc-900 underline dark:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* filtros */}
        <aside>
          <form method="GET" action="/produtos" className="space-y-8 lg:sticky lg:top-32">
            {params.q && <input type="hidden" name="q" value={params.q} />}
            {params.ordenar && <input type="hidden" name="ordenar" value={params.ordenar} />}

            <div>
              <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                Categoria
              </h3>
              <div className="space-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="radio" name="categoria" value="" defaultChecked={!params.categoria} className="accent-zinc-900 dark:accent-zinc-100" />
                  Todas
                </label>
                {categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="categoria"
                      value={c.slug}
                      defaultChecked={params.categoria === c.slug}
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                Preço (R$)
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="min"
                  min={0}
                  step="0.01"
                  placeholder="Mín."
                  defaultValue={params.min}
                  className="h-9 w-full border border-zinc-300 bg-transparent px-2.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
                />
                <span className="text-zinc-300">—</span>
                <input
                  type="number"
                  name="max"
                  min={0}
                  step="0.01"
                  placeholder="Máx."
                  defaultValue={params.max}
                  className="h-9 w-full border border-zinc-300 bg-transparent px-2.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                Avaliação mínima
              </h3>
              <div className="space-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="radio" name="avaliacao" value="" defaultChecked={!params.avaliacao} className="accent-zinc-900 dark:accent-zinc-100" />
                  Qualquer
                </label>
                {[4, 3].map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="avaliacao"
                      value={r}
                      defaultChecked={params.avaliacao === String(r)}
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    {r}★ ou mais
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="h-10 flex-1 bg-zinc-900 text-[11px] font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Filtrar
              </button>
              <Link
                href="/produtos"
                className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
              >
                Limpar
              </Link>
            </div>
          </form>
        </aside>

        {/* grade de produtos */}
        <div>
          {products.length === 0 ? (
            <EmptyState
              icon="◇"
              title="Nenhuma peça encontrada"
              description="Tente ajustar os filtros ou buscar por outro termo."
              action={
                <Link
                  href="/produtos"
                  className="text-[11px] uppercase tracking-[0.14em] text-accent underline-offset-4 hover:underline"
                >
                  Limpar filtros
                </Link>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={toCardData(p, wishedIds)} />
                ))}
              </div>

              {/* paginação */}
              {totalPages > 1 && (
                <nav className="mt-14 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <Link
                      key={n}
                      href={buildQuery({ pagina: n === 1 ? undefined : String(n) })}
                      className={cn(
                        "flex size-9 items-center justify-center text-xs transition-colors",
                        n === page
                          ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                      )}
                    >
                      {n}
                    </Link>
                  ))}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
