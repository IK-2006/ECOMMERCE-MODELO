import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { PurchaseOrderForm } from "@/components/admin/PurchaseOrderForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova ordem de compra" };

export default async function NewPurchasePage() {
  await requirePagePermission("purchases.write");

  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { variants: { where: { active: true }, orderBy: { name: "asc" } } },
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pickerItems: {
    productId: string;
    variantId: string | null;
    label: string;
    sku: string | null;
    costCents: number | null;
  }[] = [];
  for (const p of products) {
    if (p.variants.length > 0) {
      for (const v of p.variants) {
        pickerItems.push({
          productId: p.id,
          variantId: v.id,
          label: `${p.name} · ${v.name}`,
          sku: v.sku ?? p.sku,
          costCents: v.costCents ?? p.costCents ?? null,
        });
      }
    } else {
      pickerItems.push({ productId: p.id, variantId: null, label: p.name, sku: p.sku, costCents: p.costCents ?? null });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Nova ordem de compra</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Monte a compra com os itens e custos esperados. Depois você envia ao fornecedor e recebe (parcial ou total).
        </p>
      </div>
      <PurchaseOrderForm items={pickerItems} suppliers={suppliers} />
    </div>
  );
}
