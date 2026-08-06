import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { dre, salesMargin, accountBalances } from "@/services/finance";
import { abcCurve } from "@/services/reports";
import { lowStockItems } from "@/services/stock";

export const dynamic = "force-dynamic";
export const metadata = { title: "BI — Painel executivo" };

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];
const GOAL_CENTS = Number(process.env.MONTHLY_REVENUE_GOAL_CENTS) || 1_000_000;

async function periodStats(from: Date, to: Date) {
  const [orders, margin] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: PAID_STATUSES }, paidAt: { gte: from, lte: to } },
      select: { totalCents: true },
    }),
    salesMargin({ from, to }),
  ]);
  const revenue = orders.reduce((s, o) => s + o.totalCents, 0);
  return {
    revenue,
    count: orders.length,
    avg: orders.length ? Math.round(revenue / orders.length) : 0,
    grossProfit: margin.grossProfitCents,
  };
}

function delta(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

export default async function BiPage() {
  await requirePagePermission("reports.read");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(monthStart.getTime() - 1);

  const [cur, prev, dreData, balances, abc, lowStock, monthOrders] = await Promise.all([
    periodStats(monthStart, now),
    periodStats(prevMonthStart, prevMonthEnd),
    dre({ from: monthStart, to: now }),
    accountBalances(),
    abcCurve({ from: monthStart, to: now }),
    lowStockItems(),
    prisma.order.findMany({
      where: { status: { in: PAID_STATUSES }, paidAt: { gte: monthStart, lte: now } },
      select: { paidAt: true, totalCents: true },
    }),
  ]);

  // série diária do mês (faturamento)
  const daily = new Map<string, number>();
  const days = now.getDate();
  for (let d = 1; d <= days; d++) {
    const key = new Date(now.getFullYear(), now.getMonth(), d).toISOString().slice(0, 10);
    daily.set(key, 0);
  }
  for (const o of monthOrders) {
    const key = (o.paidAt ?? now).toISOString().slice(0, 10);
    if (daily.has(key)) daily.set(key, (daily.get(key) ?? 0) + o.totalCents);
  }
  const chartData = [...daily.entries()].map(([date, cents]) => ({
    date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    valor: cents / 100,
  }));

  const goalPct = GOAL_CENTS > 0 ? Math.min(100, (cur.revenue / GOAL_CENTS) * 100) : 0;
  const totalBalance = balances.reduce((s, b) => s + b.balanceCents, 0);
  const topA = abc.filter((r) => r.klass === "A").slice(0, 5);

  const kpis = [
    { label: "Faturamento (mês)", value: formatCurrency(cur.revenue), d: delta(cur.revenue, prev.revenue) },
    { label: "Pedidos pagos", value: String(cur.count), d: delta(cur.count, prev.count) },
    { label: "Ticket médio", value: formatCurrency(cur.avg), d: delta(cur.avg, prev.avg) },
    { label: "Lucro bruto (vendas − CMV)", value: formatCurrency(cur.grossProfit), d: delta(cur.grossProfit, prev.grossProfit) },
  ];

  const card = "rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
  const dreMax = Math.max(dreData.incomeCents, dreData.expenseCents, 1);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">BI — Painel executivo</h1>
        <p className="mt-1 text-sm text-zinc-500">Mês atual vs. mês anterior · metas, resultado e tendência.</p>
      </div>

      {/* KPIs com comparativo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={card}>
            <p className="text-xs uppercase tracking-wide text-zinc-400">{k.label}</p>
            <p className="mt-2 text-2xl font-bold">{k.value}</p>
            {k.d != null && (
              <p className={`mt-1 text-xs font-medium ${k.d >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {k.d >= 0 ? "▲" : "▼"} {Math.abs(k.d).toFixed(1)}% vs. mês anterior
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Meta + saldo */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Meta de faturamento do mês</h2>
            <span className="text-sm text-zinc-500">{formatCurrency(cur.revenue)} / {formatCurrency(GOAL_CENTS)}</span>
          </div>
          <div className="mt-3 h-4 w-full overflow-hidden rounded-none bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full bg-accent" style={{ width: `${goalPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">{goalPct.toFixed(1)}% da meta (configurável em MONTHLY_REVENUE_GOAL_CENTS)</p>

          <h2 className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Faturamento diário</h2>
          <div className="mt-3 h-56">
            <RevenueChart data={chartData} />
          </div>
        </div>

        <div className={card}>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Saldo em contas</h2>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalBalance)}</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {balances.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span className="text-zinc-500">{b.name}</span>
                <span className="tabular-nums font-medium">{formatCurrency(b.balanceCents)}</span>
              </li>
            ))}
          </ul>
          {lowStock.length > 0 && (
            <p className="mt-4 rounded-none border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {lowStock.length} item(ns) no estoque mínimo ou abaixo.
            </p>
          )}
        </div>
      </div>

      {/* DRE visual + Top A */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className={card}>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">DRE do mês (realizado)</h2>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm"><span className="text-emerald-600">Receitas</span><span className="font-medium">{formatCurrency(dreData.incomeCents)}</span></div>
              <div className="mt-1 h-3 w-full rounded-none bg-zinc-100 dark:bg-zinc-800"><div className="h-full bg-emerald-500" style={{ width: `${(dreData.incomeCents / dreMax) * 100}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span className="text-red-600">Despesas</span><span className="font-medium">{formatCurrency(dreData.expenseCents)}</span></div>
              <div className="mt-1 h-3 w-full rounded-none bg-zinc-100 dark:bg-zinc-800"><div className="h-full bg-red-500" style={{ width: `${(dreData.expenseCents / dreMax) * 100}%` }} /></div>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
              <span className="font-medium">Resultado</span>
              <span className={`text-lg font-bold ${dreData.resultCents >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(dreData.resultCents)}</span>
            </div>
          </div>
        </div>

        <div className={card}>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Top produtos (classe A)</h2>
          {topA.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">Sem vendas no mês.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {topA.map((r, i) => (
                <li key={r.name} className="flex items-center gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent dark:bg-accent-soft-dark">{i + 1}</span>
                  <span className="line-clamp-1 flex-1">{r.name}</span>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">A</Badge>
                  <span className="shrink-0 tabular-nums text-zinc-500">{formatCurrency(r.revenueCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
