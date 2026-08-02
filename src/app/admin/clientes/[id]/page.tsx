import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatCep,
  formatDate,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
      addresses: true,
      reviews: { include: { product: { select: { name: true, slug: true } } } },
    },
  });
  if (!customer) notFound();

  const paidOrders = customer.orders.filter((o) =>
    ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"].includes(o.status)
  );
  const totalSpent = paidOrders.reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/clientes" className="text-sm text-zinc-400 hover:text-accent">
        ← Clientes
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-medium tracking-tight">{customer.name}</h1>
        {customer.role === "ADMIN" && (
          <Badge className="bg-accent-soft text-accent dark:bg-accent-soft-dark">Admin</Badge>
        )}
      </div>
      <p className="text-sm text-zinc-500">
        {customer.email}
        {customer.phone && ` · ${customer.phone}`} · cliente desde {formatDate(customer.createdAt)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Pedidos</p>
          <p className="mt-1 text-2xl font-bold">{customer.orders.length}</p>
        </div>
        <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Total gasto</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Avaliações</p>
          <p className="mt-1 text-2xl font-bold">{customer.reviews.length}</p>
        </div>
      </div>

      <h2 className="mt-8 font-semibold">Pedidos</h2>
      <div className="mt-3 overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Pedido</th>
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {customer.orders.map((o) => (
              <tr key={o.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="p-4">
                  <Link href={`/admin/pedidos/${o.id}`} className="font-medium text-accent hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className="p-4 text-zinc-500">{formatDateTime(o.createdAt)}</td>
                <td className="p-4">
                  <Badge className={ORDER_STATUS_COLORS[o.status]}>
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </Badge>
                </td>
                <td className="p-4 text-right font-medium">{formatCurrency(o.totalCents)}</td>
              </tr>
            ))}
            {customer.orders.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-400">Nenhum pedido.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {customer.addresses.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Endereços</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {customer.addresses.map((a) => (
              <div key={a.id} className="rounded-none border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="font-medium">{a.label} — {a.recipient}</p>
                <p className="mt-1 text-zinc-500">
                  {a.street}, {a.number}{a.complement ? ` – ${a.complement}` : ""} · {a.district}
                  <br />
                  {a.city}/{a.state} · CEP {formatCep(a.cep)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
