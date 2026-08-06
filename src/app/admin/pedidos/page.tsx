import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { Badge } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUSES,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePagePermission("orders.read");
  const { status, q } = await searchParams;

  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { number: { contains: q } },
        { user: { name: { contains: q } } },
        { user: { email: { contains: q } } },
        { trackingCode: { contains: q } },
      ],
    }),
  };

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { name: true, email: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count]));
  const total = counts.reduce((s, c) => s + c._count, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Pedidos</h1>

      {/* filtros por status */}
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/pedidos"
          className={cn(
            "rounded-full px-3.5 py-1.5 transition-colors",
            !status
              ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-600 hover:border-accent dark:border-zinc-700 dark:text-zinc-300"
          )}
        >
          Todos ({total})
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/pedidos?status=${s}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 transition-colors",
              status === s
                ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:border-accent dark:border-zinc-700 dark:text-zinc-300"
            )}
          >
            {ORDER_STATUS_LABELS[s]} ({countByStatus.get(s) ?? 0})
          </Link>
        ))}
      </div>

      <form method="GET" className="mt-4">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nº do pedido, cliente, e-mail ou rastreio..."
          className="h-10 w-full max-w-md rounded-none border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </form>

      <div className="mt-5 overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Pedido</th>
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Cliente</th>
              <th className="p-4 font-medium">Itens</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
              >
                <td className="p-4">
                  <Link href={`/admin/pedidos/${o.id}`} className="font-medium text-accent hover:underline">
                    {o.number}
                  </Link>
                  {o.channel === "LOJA" && (
                    <Badge className="ml-2 bg-accent-soft text-accent dark:bg-accent-soft-dark">
                      Loja
                    </Badge>
                  )}
                </td>
                <td className="p-4 text-zinc-500">{formatDateTime(o.createdAt)}</td>
                <td className="p-4">
                  <p className="font-medium">{o.user.name}</p>
                  <p className="text-xs text-zinc-400">{o.user.email}</p>
                </td>
                <td className="p-4">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                <td className="p-4">
                  <Badge className={ORDER_STATUS_COLORS[o.status]}>
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </Badge>
                </td>
                <td className="p-4 text-right font-medium">{formatCurrency(o.totalCents)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-zinc-400">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
