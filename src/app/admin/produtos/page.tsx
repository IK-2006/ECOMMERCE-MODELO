import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ordenar?: string }>;
}) {
  await requirePagePermission("products.read");
  const { q, ordenar } = await searchParams;

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    ordenar === "menor-preco"
      ? { priceCents: "asc" }
      : ordenar === "maior-preco"
        ? { priceCents: "desc" }
        : ordenar === "nome"
          ? { name: "asc" }
          : ordenar === "estoque"
            ? { stock: "asc" }
            : { createdAt: "desc" };

  const products = await prisma.product.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { brand: { contains: q } }] }
      : undefined,
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { active: true } },
    },
    orderBy,
    take: 200,
  });

  const sortOptions: [string, string][] = [
    ["recentes", "Mais recentes"],
    ["menor-preco", "Menor preço"],
    ["maior-preco", "Maior preço"],
    ["nome", "Nome (A–Z)"],
    ["estoque", "Menor estoque"],
  ];
  const currentSort = ordenar ?? "recentes";
  const sortHref = (key: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (key !== "recentes") p.set("ordenar", key);
    const qs = p.toString();
    return qs ? `/admin/produtos?${qs}` : "/admin/produtos";
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Produtos</h1>
        <div className="flex items-center gap-3">
          <form method="GET">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome, SKU, marca..."
              className="h-10 w-64 rounded-none border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </form>
          <Link href="/admin/produtos/novo">
            <Button>+ Novo produto</Button>
          </Link>
        </div>
      </div>

      {/* ordenação */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="uppercase tracking-wide text-zinc-400">Ordenar:</span>
        {sortOptions.map(([key, label]) => (
          <Link
            key={key}
            href={sortHref(key)}
            className={cn(
              "underline-offset-4 transition-colors",
              currentSort === key
                ? "font-medium text-accent underline"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Produto</th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium">Categoria</th>
              <th className="p-4 font-medium">Preço</th>
              <th className="p-4 font-medium">Estoque</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock =
                p.variants.length > 0
                  ? p.variants.reduce((s, v) => s + v.stock, 0)
                  : p.stock;
              return (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                >
                  <td className="p-4">
                    <Link href={`/admin/produtos/${p.id}`} className="flex items-center gap-3">
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0].url} alt="" className="size-full object-cover" />
                        ) : null}
                      </span>
                      <span className="block font-medium hover:text-accent">{p.name}</span>
                    </Link>
                  </td>
                  <td className="p-4 whitespace-nowrap font-mono text-xs text-zinc-500">
                    {p.sku ?? "—"}
                  </td>
                  <td className="p-4 text-zinc-500">{p.category.name}</td>
                  <td className="p-4 font-medium">{formatCurrency(p.priceCents)}</td>
                  <td className="p-4">
                    <span className={stock <= 5 ? "font-semibold text-amber-600" : ""}>
                      {stock} un.
                    </span>
                    {p.variants.length > 0 && (
                      <span className="ml-1 text-xs text-zinc-400">
                        ({p.variants.length} var.)
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1.5">
                      {p.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge>Inativo</Badge>
                      )}
                      {p.featured && (
                        <Badge className="bg-accent-soft text-accent dark:bg-accent-soft-dark">
                          Destaque
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-zinc-400">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
