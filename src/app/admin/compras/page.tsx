import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PO_STATUS_LABELS } from "@/services/purchases";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compras" };

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ENVIADA: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  RECEBIDA_PARCIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  RECEBIDA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  CANCELADA: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default async function PurchasesPage() {
  await requirePagePermission("purchases.read");

  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { _count: { select: { items: true } } },
  });

  const supplierIds = [...new Set(orders.map((o) => o.supplierId).filter(Boolean) as string[])];
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
    : [];
  const sName = new Map(suppliers.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Compras</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ordens de compra: peça ao fornecedor e receba (parcial ou total). O recebimento dá entrada no estoque e gera a conta a pagar.
          </p>
        </div>
        <Link href="/admin/compras/nova">
          <Button>+ Nova ordem de compra</Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-none border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
          Nenhuma ordem de compra ainda. Crie a primeira para registrar uma compra.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="p-4 font-medium">Ordem</th>
                <th className="p-4 font-medium">Fornecedor</th>
                <th className="p-4 font-medium">Itens</th>
                <th className="p-4 font-medium">Previsão</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="p-4">
                    <Link href={`/admin/compras/${o.id}`} className="font-medium text-accent hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="p-4 text-zinc-500">{o.supplierId ? sName.get(o.supplierId) ?? "—" : "—"}</td>
                  <td className="p-4 text-zinc-500">{o._count.items}</td>
                  <td className="p-4 text-zinc-500">{o.expectedAt ? formatDate(o.expectedAt) : "—"}</td>
                  <td className="p-4">
                    <Badge className={STATUS_COLORS[o.status]}>{PO_STATUS_LABELS[o.status] ?? o.status}</Badge>
                  </td>
                  <td className="p-4 text-right font-medium">{formatCurrency(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
