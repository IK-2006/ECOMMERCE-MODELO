import { prisma } from "@/lib/prisma";
import { PdvTerminal } from "@/components/admin/PdvTerminal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venda em Loja" };

export default async function PdvPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { active: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const data = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    priceCents: p.priceCents,
    image: p.images[0]?.url ?? null,
    stock: p.stock,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: v.priceCents,
      stock: v.stock,
    })),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Venda em Loja</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Registre vendas do balcão (dinheiro, Pix ou cartão na maquininha). O estoque é
          baixado na hora e a venda entra nos relatórios.
        </p>
      </div>
      <PdvTerminal products={data} />
    </div>
  );
}
