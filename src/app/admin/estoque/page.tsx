import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency } from "@/lib/utils";
import { StockEntryPanel } from "@/components/admin/StockEntryPanel";
import { InventoryPanel } from "@/components/admin/InventoryPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estoque" };

export default async function StockPage() {
  await requirePagePermission("stock.read");
  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { variants: { where: { active: true }, orderBy: { name: "asc" } } },
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // linhas de estoque — nível de variação quando houver
  type Row = {
    key: string;
    name: string;
    variant: string | null;
    sku: string | null;
    stock: number;
    costCents: number | null;
    min: number | null;
  };
  const rows: Row[] = [];
  const pickerItems: { productId: string; variantId: string | null; label: string; sku: string | null; stock: number }[] = [];

  for (const p of products) {
    if (p.variants.length > 0) {
      for (const v of p.variants) {
        rows.push({ key: v.id, name: p.name, variant: v.name, sku: v.sku ?? p.sku, stock: v.stock, costCents: v.costCents ?? p.costCents, min: p.minStock });
        pickerItems.push({ productId: p.id, variantId: v.id, label: `${p.name} · ${v.name}`, sku: v.sku ?? p.sku, stock: v.stock });
      }
    } else {
      rows.push({ key: p.id, name: p.name, variant: null, sku: p.sku, stock: p.stock, costCents: p.costCents, min: p.minStock });
      pickerItems.push({ productId: p.id, variantId: null, label: p.name, sku: p.sku, stock: p.stock });
    }
  }

  const totalUnits = rows.reduce((s, r) => s + r.stock, 0);
  const totalValuation = rows.reduce((s, r) => s + (r.costCents != null ? r.costCents * r.stock : 0), 0);
  const lowCount = rows.filter((r) => r.stock <= 0 || (r.min != null && r.stock <= r.min)).length;

  const statusOf = (r: Row) =>
    r.stock <= 0 ? "esgotado" : r.min != null && r.stock <= r.min ? "baixo" : "ok";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Estoque</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Posição do estoque, custo e valorização. Use “Entrada de mercadoria” para lançar compras.
          </p>
        </div>
        <div className="flex gap-2">
          <InventoryPanel items={pickerItems} />
          <StockEntryPanel items={pickerItems} suppliers={suppliers} />
        </div>
      </div>

      {/* resumo */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Valor em estoque (custo)", value: formatCurrency(totalValuation) },
          { label: "Itens em estoque", value: totalUnits.toLocaleString("pt-BR") },
          { label: "Alertas (baixo/esgotado)", value: String(lowCount), warn: lowCount > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">{s.label}</p>
            <p className={`mt-1 font-serif text-3xl font-medium tabular-nums ${s.warn ? "text-amber-600" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Produto</th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium text-right">Estoque</th>
              <th className="p-4 font-medium text-right">Custo</th>
              <th className="p-4 font-medium text-right">Valor em estoque</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = statusOf(r);
              return (
                <tr key={r.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="p-4">
                    <span className="font-medium">{r.name}</span>
                    {r.variant && <span className="text-zinc-400"> · {r.variant}</span>}
                  </td>
                  <td className="p-4 text-zinc-500">{r.sku || "—"}</td>
                  <td className="p-4 text-right tabular-nums font-medium">{r.stock}</td>
                  <td className="p-4 text-right tabular-nums text-zinc-500">
                    {r.costCents != null ? formatCurrency(r.costCents) : "—"}
                  </td>
                  <td className="p-4 text-right tabular-nums text-zinc-500">
                    {r.costCents != null ? formatCurrency(r.costCents * r.stock) : "—"}
                  </td>
                  <td className="p-4">
                    {st === "esgotado" ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Esgotado</span>
                    ) : st === "baixo" ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Baixo</span>
                    ) : (
                      <span className="text-[11px] uppercase tracking-wide text-zinc-400">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
