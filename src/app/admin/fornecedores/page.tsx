import { prisma } from "@/lib/prisma";
import { SupplierManager } from "@/components/admin/SupplierManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fornecedores" };

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const data = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    cnpj: s.cnpj,
    phone: s.phone,
    email: s.email,
    notes: s.notes,
    active: s.active,
    productCount: s._count.products,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Fornecedores</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre de quem você compra. Os fornecedores aparecem na entrada de mercadoria e nos relatórios de estoque.
        </p>
      </div>
      <SupplierManager suppliers={data} />
    </div>
  );
}
