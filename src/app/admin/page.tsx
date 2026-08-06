import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { lowStockItems } from "@/services/stock";
import { formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { RevenueChart } from "@/components/admin/RevenueChart";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];

export default async function AdminDashboard() {
  await requirePagePermission("dashboard.view");
  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * 864e5);
  const prev30 = new Date(now.getTime() - 60 * 864e5);

  const [ordersLast30, ordersPrev30, pendingCount, lowStock, recentOrders, paidOrdersForChart, topItems] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start30 }, status: { in: PAID_STATUSES } },
        select: { totalCents: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: prev30, lt: start30 }, status: { in: PAID_STATUSES } },
        select: { totalCents: true },
      }),
      prisma.order.count({ where: { status: "AGUARDANDO_PAGAMENTO" } }),
      lowStockItems(),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true } } },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: start30 }, status: { in: PAID_STATUSES } },
        select: { createdAt: true, totalCents: true },
      }),
      prisma.orderItem.groupBy({
        by: ["name"],
        where: { order: { createdAt: { gte: start30 }, status: { in: PAID_STATUSES } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

  const revenue = ordersLast30.reduce((s, o) => s + o.totalCents, 0);
  const prevRevenue = ordersPrev30.reduce((s, o) => s + o.totalCents, 0);
  const revenueDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;
  const avgTicket = ordersLast30.length > 0 ? Math.round(revenue / ordersLast30.length) : 0;

  // série diária p/ gráfico de faturamento
  const daily = new Map<string, number>();
  for (let d = 0; d < 30; d++) {
    const day = new Date(now.getTime() - (29 - d) * 864e5);
    daily.set(day.toISOString().slice(0, 10), 0);
  }
  for (const o of paidOrdersForChart) {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (daily.has(key)) daily.set(key, (daily.get(key) ?? 0) + o.totalCents);
  }
  const chartData = [...daily.entries()].map(([date, cents]) => ({
    date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    valor: cents / 100,
  }));

  const stats = [
    {
      label: "Faturamento (30 dias)",
      value: formatCurrency(revenue),
      delta: revenueDelta,
    },
    { label: "Pedidos pagos (30 dias)", value: String(ordersLast30.length) },
    { label: "Ticket médio", value: formatCurrency(avgTicket) },
    { label: "Aguardando pagamento", value: String(pendingCount) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Dashboard</h1>
      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
        Visão geral dos últimos 30 dias
      </p>

      {/* métricas */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
            {s.delta != null && (
              <p className={`mt-1 text-xs font-medium ${s.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta).toFixed(1)}% vs. período anterior
              </p>
            )}
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <p className="mt-4 rounded-none border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {lowStock.length} item{lowStock.length > 1 ? "s" : ""} no estoque mínimo ou abaixo.{" "}
          <Link href="/admin/estoque" className="font-medium underline">Ver estoque</Link>
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* gráfico */}
        <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Faturamento diário</h2>
          <div className="mt-4 h-64">
            <RevenueChart data={chartData} />
          </div>
        </div>

        {/* top produtos */}
        <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Mais vendidos (30 dias)</h2>
          {topItems.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">Sem vendas no período.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {topItems.map((item, i) => (
                <li key={item.name} className="flex items-center gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent dark:bg-accent-soft-dark">
                    {i + 1}
                  </span>
                  <span className="line-clamp-1 flex-1">{item.name}</span>
                  <span className="shrink-0 text-zinc-400">{item._sum.quantity} un.</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* pedidos recentes */}
      <div className="mt-6 rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Pedidos recentes</h2>
          <Link href="/admin/pedidos" className="text-[11px] uppercase tracking-[0.14em] text-accent hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="pb-2 pr-4 font-medium">Pedido</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/pedidos/${o.id}`} className="font-medium text-accent hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{o.user.name}</td>
                  <td className="py-3 pr-4">
                    <Badge className={ORDER_STATUS_COLORS[o.status]}>
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-right font-medium">{formatCurrency(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
