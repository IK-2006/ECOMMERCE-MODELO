import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { ReportDownload } from "@/components/admin/ReportDownload";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];

export default async function AdminReportsPage() {
  const now = new Date();
  const periods = [
    { label: "Últimos 7 dias", days: 7 },
    { label: "Últimos 30 dias", days: 30 },
    { label: "Últimos 90 dias", days: 90 },
  ];

  const summaries = await Promise.all(
    periods.map(async (p) => {
      const start = new Date(now.getTime() - p.days * 864e5);
      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start }, status: { in: PAID_STATUSES } },
        select: { totalCents: true },
      });
      const revenue = orders.reduce((s, o) => s + o.totalCents, 0);
      return {
        ...p,
        count: orders.length,
        revenue,
        avg: orders.length ? Math.round(revenue / orders.length) : 0,
      };
    })
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Relatórios de vendas</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {summaries.map((s) => (
          <div key={s.label} className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
            <p className="mt-2 text-xl font-bold">{formatCurrency(s.revenue)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {s.count} pedidos pagos · ticket médio {formatCurrency(s.avg)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Exportar relatório</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Exporta todos os pedidos do período em CSV (abre no Excel/Google Sheets).
          Para PDF, use a exportação e imprima, ou o atalho de impressão do navegador
          nesta página (Ctrl+P).
        </p>
        <div className="mt-4">
          <ReportDownload />
        </div>
      </div>
    </div>
  );
}
