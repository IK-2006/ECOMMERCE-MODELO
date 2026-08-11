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

type Param = string | string[] | undefined;
interface CatalogSearchParams {
  q?: Param;
  categoria?: Param;
  tamanho?: Param;
  cor?: Param;
  min?: Param;
  max?: Param;
  avaliacao?: Param;
  promocao?: Param;
  ordenar?: Param;
  pagina?: Param;
}

const one = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const many = (v: Param): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

// ordem de exibição dos tamanhos (o resto entra depois, numérico/alfabético)
const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "U", "ÚNICO", "UNICO"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? 100 : i;
};

interface State {
  q?: string;
  categoria?: string;
  sizes: string[];
  cores: string[];
  min?: string;
  max?: string;
  avaliacao?: string;
  promo: boolean;
  ordenar?: string;
  pagina?: string;
}

function serialize(s: State): string {
  const sp = new URLSearchParams();
  if (s.q) sp.set("q", s.q);
  if (s.categoria) sp.set("categoria", s.categoria);
  for (const x of s.sizes) sp.append("tamanho", x);
  for (const x of s.cores) sp.append("cor", x);
  if (s.min) sp.set("min", s.min);
  if (s.max) sp.set("max", s.max);
  if (s.avaliacao) sp.set("avaliacao", s.avaliacao);
  if (s.promo) sp.set("promocao", "1");
  if (s.ordenar) sp.set("ordenar", s.ordenar);
  if (s.pagina && s.pagina !== "1") sp.set("pagina", s.pagina);
  const str = sp.toString();
  return str ? `/produtos?${str}` : "/produtos";
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const categoria = one(params.categoria);
  const sizes = many(params.tamanho);
  const cores = many(params.cor);
  const minStr = one(params.min);
  const maxStr = one(params.max);
  const avalStr = one(params.avaliacao);
  const promo = one(params.promocao) === "1";
  const ordenar = one(params.ordenar);
  const paginaStr = one(params.pagina);

  const page = Math.max(1, parseInt(paginaStr ?? "1", 10) || 1);
  const minReais = parseFloat(minStr ?? "") || null;
  const maxReais = parseFloat(maxStr ?? "") || null;
  const minRating = parseInt(avalStr ?? "", 10) || null;

  const where: Prisma.ProductWhereInput = { active: true };
  if (q)
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { brand: { contains: q } },
    ];
  if (categoria) where.category = { slug: categoria };
  if (minReais != null || maxReais != null)
    where.priceCents = {
      ...(minReais != null ? { gte: Math.round(minReais * 100) } : {}),
      ...(maxReais != null ? { lte: Math.round(maxReais * 100) } : {}),
    };
  if (minRating != null) where.ratingAvg = { gte: minRating };
  if (promo) where.compareAtCents = { not: null };
  // tamanho e cor são facetas independentes (produto com alguma variação no filtro)
  const variantAnd: Prisma.ProductWhereInput[] = [];
  if (sizes.length) variantAnd.push({ variants: { some: { active: true, size: { in: sizes } } } });
  if (cores.length) variantAnd.push({ variants: { some: { active: true, color: { in: cores } } } });
  if (variantAnd.length) where.AND = variantAnd;

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    ordenar === "menor-preco"
      ? { priceCents: "asc" }
      : ordenar === "maior-preco"
        ? { priceCents: "desc" }
        : ordenar === "avaliacao"
          ? { ratingAvg: "desc" }
          : ordenar === "nome"
            ? { name: "asc" }
            : ordenar === "recentes"
              ? { createdAt: "desc" }
              : { featured: "desc" };

  const [products, total, categories, catCountRows, variantRows, wishedIds] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productCardInclude,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.product.groupBy({ by: ["categoryId"], where: { active: true }, _count: { _all: true } }),
    prisma.productVariant.findMany({
      where: { active: true, product: { active: true } },
      select: { size: true, color: true },
    }),
    getWishedIds(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const activeCategory = categories.find((c) => c.slug === categoria);
  const catCount = new Map(catCountRows.map((r) => [r.categoryId, r._count._all]));

  // facetas de tamanho/cor a partir das variações ativas
  const sizeSet = new Set<string>();
  const colorSet = new Set<string>();
  for (const v of variantRows) {
    if (v.size) sizeSet.add(v.size);
    if (v.color) colorSet.add(v.color);
  }
  const allSizes = [...sizeSet].sort((a, b) => {
    const ra = sizeRank(a), rb = sizeRank(b);
    if (ra !== rb) return ra - rb;
    const na = parseFloat(a), nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, "pt-BR");
  });
  const allColors = [...colorSet].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const current: State = { q, categoria, sizes, cores, min: minStr, max: maxStr, avaliacao: avalStr, promo, ordenar, pagina: paginaStr };
  const withReset = (patch: Partial<State>): State => ({ ...current, ...patch, pagina: "1" });

  // chips de filtros ativos (removíveis)
  const chips: { label: string; href: string }[] = [];
  if (q) chips.push({ label: `Busca: “${q}”`, href: serialize(withReset({ q: undefined })) });
  if (activeCategory) chips.push({ label: activeCategory.name, href: serialize(withReset({ categoria: undefined })) });
  for (const sz of sizes) chips.push({ label: `Tam ${sz}`, href: serialize(withReset({ sizes: sizes.filter((x) => x !== sz) })) });
  for (const co of cores) chips.push({ label: co, href: serialize(withReset({ cores: cores.filter((x) => x !== co) })) });
  if (minStr || maxStr) chips.push({ label: `R$ ${minStr || "0"}–${maxStr || "∞"}`, href: serialize(withReset({ min: undefined, max: undefined })) });
  if (avalStr) chips.push({ label: `${avalStr}★ ou mais`, href: serialize(withReset({ avaliacao: undefined })) });
  if (promo) chips.push({ label: "Em promoção", href: serialize(withReset({ promo: false })) });

  const sortOptions: [string, string][] = [
    ["relevancia", "Relevância"],
    ["recentes", "Novidades"],
    ["menor-preco", "Menor preço"],
    ["maior-preco", "Maior preço"],
    ["avaliacao", "Avaliação"],
    ["nome", "A–Z"],
  ];

  const H3 = "mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            {q ? `Resultados para “${q}”` : activeCategory?.name ?? "Todos os produtos"}
          </h1>
          <p className="mt-2 text-xs tracking-wide text-zinc-400">
            {total} PEÇA{total === 1 ? "" : "S"}
          </p>
        </div>

        {/* ordenação */}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {sortOptions.map(([key, label]) => {
            const active = (ordenar ?? "relevancia") === key;
            return (
              <Link
                key={key}
                href={serialize(withReset({ ordenar: key === "relevancia" ? undefined : key }))}
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

      {/* filtros ativos */}
      {chips.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Filtros:</span>
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="group inline-flex items-center gap-1.5 border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
            >
              {chip.label}
              <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">×</span>
            </Link>
          ))}
          <Link
            href="/produtos"
            className="ml-1 text-[11px] uppercase tracking-[0.14em] text-accent underline-offset-4 hover:underline"
          >
            Limpar tudo
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* filtros */}
        <aside>
          <form method="GET" action="/produtos" className="space-y-8 lg:sticky lg:top-32">
            {q && <input type="hidden" name="q" value={q} />}
            {ordenar && <input type="hidden" name="ordenar" value={ordenar} />}

            <div>
              <h3 className={H3}>Categoria</h3>
              <div className="space-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="radio" name="categoria" value="" defaultChecked={!categoria} className="accent-zinc-900 dark:accent-zinc-100" />
                  Todas
                </label>
                {categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center justify-between gap-2.5">
                    <span className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="categoria"
                        value={c.slug}
                        defaultChecked={categoria === c.slug}
                        className="accent-zinc-900 dark:accent-zinc-100"
                      />
                      {c.name}
                    </span>
                    <span className="text-xs tabular-nums text-zinc-400">{catCount.get(c.id) ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {allSizes.length > 0 && (
              <div>
                <h3 className={H3}>Tamanho</h3>
                <div className="flex flex-wrap gap-2">
                  {allSizes.map((sz) => (
                    <label
                      key={sz}
                      className="relative cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="tamanho"
                        value={sz}
                        defaultChecked={sizes.includes(sz)}
                        className="peer sr-only"
                      />
                      <span className="flex min-w-9 items-center justify-center border border-zinc-300 px-2.5 py-1.5 text-xs uppercase transition-colors hover:border-zinc-900 peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-white dark:border-zinc-700 dark:hover:border-zinc-100 dark:peer-checked:border-zinc-100 dark:peer-checked:bg-zinc-100 dark:peer-checked:text-zinc-900">
                        {sz}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {allColors.length > 0 && (
              <div>
                <h3 className={H3}>Cor</h3>
                <div className="space-y-2 text-sm">
                  {allColors.map((co) => (
                    <label key={co} className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="cor"
                        value={co}
                        defaultChecked={cores.includes(co)}
                        className="accent-zinc-900 dark:accent-zinc-100"
                      />
                      {co}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className={H3}>Preço (R$)</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="min"
                  min={0}
                  step="0.01"
                  placeholder="Mín."
                  defaultValue={minStr}
                  className="h-9 w-full border border-zinc-300 bg-transparent px-2.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
                />
                <span className="text-zinc-300">—</span>
                <input
                  type="number"
                  name="max"
                  min={0}
                  step="0.01"
                  placeholder="Máx."
                  defaultValue={maxStr}
                  className="h-9 w-full border border-zinc-300 bg-transparent px-2.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
                />
              </div>
            </div>

            <div>
              <h3 className={H3}>Avaliação mínima</h3>
              <div className="space-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="radio" name="avaliacao" value="" defaultChecked={!avalStr} className="accent-zinc-900 dark:accent-zinc-100" />
                  Qualquer
                </label>
                {[4, 3].map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="avaliacao"
                      value={r}
                      defaultChecked={avalStr === String(r)}
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    {r}★ ou mais
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className={H3}>Ofertas</h3>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="promocao"
                  value="1"
                  defaultChecked={promo}
                  className="accent-zinc-900 dark:accent-zinc-100"
                />
                Somente em promoção
              </label>
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
                      href={serialize({ ...current, pagina: String(n) })}
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
