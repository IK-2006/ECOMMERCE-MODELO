import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { PO_STATUS_LABELS } from "@/services/purchases";
import { PurchaseOrderActions } from "@/components/admin/PurchaseOrderActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordem de compra" };

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ENVIADA: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  RECEBIDA_PARCIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  RECEBIDA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  CANCELADA: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("purchases.read");
  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!po) notFound();

  const supplier = po.supplierId
    ? await prisma.supplier.findUnique({ where: { id: po.supplierId }, select: { name: true } })
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/compras" className="text-[11px] uppercase tracking-[0.14em] text-accent hover:underline">
        ← Compras
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-medium tracking-tight">{po.number}</h1>
            <Badge className={STATUS_COLORS[po.status]}>{PO_STATUS_LABELS[po.status] ?? po.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {supplier?.name ?? "Sem fornecedor"}
            {po.expectedAt ? ` · previsão ${formatDate(po.expectedAt)}` : ""}
          </p>
          {po.notes && <p className="mt-2 text-sm text-zinc-500">{po.notes}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-zinc-400">Total estimado</p>
          <p className="font-serif text-2xl font-medium tabular-nums">{formatCurrency(po.totalCents)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Produto</th>
              <th className="p-4 text-right font-medium">Custo un.</th>
              <th className="p-4 text-right font-medium">Pedido</th>
              <th className="p-4 text-right font-medium">Recebido</th>
              <th className="p-4 text-right font-medium">Pendente</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((it) => {
              const pending = it.quantity - it.receivedQty;
              return (
                <tr key={it.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="p-4">{it.name}</td>
                  <td className="p-4 text-right tabular-nums text-zinc-500">{formatCurrency(it.unitCostCents)}</td>
                  <td className="p-4 text-right tabular-nums">{it.quantity}</td>
                  <td className="p-4 text-right tabular-nums">{it.receivedQty}</td>
                  <td className={`p-4 text-right tabular-nums font-medium ${pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {pending}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <PurchaseOrderActions
          id={po.id}
          status={po.status}
          items={po.items.map((it) => ({
            id: it.id,
            name: it.name,
            pending: it.quantity - it.receivedQty,
            unitCostCents: it.unitCostCents,
          }))}
        />
      </div>
    </div>
  );
}
