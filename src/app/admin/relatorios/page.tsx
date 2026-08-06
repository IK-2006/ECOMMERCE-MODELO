import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency } from "@/lib/utils";
import { ReportDownload } from "@/components/admin/ReportDownload";
import { Badge } from "@/components/ui/Badge";
import { abcCurve } from "@/services/reports";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];
const ABC_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  C: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function AdminReportsPage() {
  await requirePagePermission("reports.read");
  const now = new Date();
  const abc = await abcCurve({ from: new Date(now.getTime() - 90 * 864e5), to: now });
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
        <h2 className="font-semibold">Exportar vendas</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Exporta os pedidos do período em CSV (abre no Excel/Google Sheets).
        </p>
        <div className="mt-4">
          <ReportDownload endpoint="sales" />
        </div>
      </div>

      <div className="mt-6 rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Exportar financeiro</h2>
        <p className="mt-1 text-sm text-zinc-500">Lançamentos (a pagar/receber e realizados) do período.</p>
        <div className="mt-4">
          <ReportDownload endpoint="finance" />
        </div>
      </div>

      <div className="mt-6 rounded-none border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Exportar estoque</h2>
        <p className="mt-1 text-sm text-zinc-500">Posição atual e valorização (custo) de todos os itens.</p>
        <div className="mt-4">
          <a
            href="/api/admin/reports/stock"
            className="inline-flex h-10 items-center rounded-none bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
          >
            ⬇ Baixar CSV de estoque
          </a>
        </div>
      </div>

      {/* Curva ABC */}
      <div className="mt-8">
        <h2 className="font-serif text-2xl font-medium tracking-tight">Curva ABC (90 dias)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Produtos por contribuição no faturamento. Classe A ≈ 80% da receita, B até 95%, C o restante.
        </p>
        {abc.length === 0 ? (
          <p className="mt-4 rounded-none border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Sem vendas no período.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="adm-table w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="p-4 font-medium">Classe</th>
                  <th className="p-4 font-medium">Produto</th>
                  <th className="p-4 text-right font-medium">Qtd</th>
                  <th className="p-4 text-right font-medium">Faturamento</th>
                  <th className="p-4 text-right font-medium">% acum.</th>
                </tr>
              </thead>
              <tbody>
                {abc.slice(0, 30).map((r) => (
                  <tr key={r.name} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="p-4"><Badge className={ABC_COLORS[r.klass]}>{r.klass}</Badge></td>
                    <td className="p-4">{r.name}</td>
                    <td className="p-4 text-right tabular-nums">{r.qty}</td>
                    <td className="p-4 text-right tabular-nums font-medium">{formatCurrency(r.revenueCents)}</td>
                    <td className="p-4 text-right tabular-nums text-zinc-500">{r.cumulativePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
