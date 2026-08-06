import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requirePagePermission("products.write");
  const categories = await prisma.category.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 font-serif text-3xl font-medium tracking-tight">Categorias</h1>
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          position: c.position,
          active: c.active,
          productCount: c._count.products,
        }))}
      />
    </div>
  );
}
