import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 font-serif text-3xl font-medium tracking-tight">Novo produto</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
