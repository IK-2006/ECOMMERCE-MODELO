import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import {
  ensureFinanceDefaults,
  accountBalances,
  cashFlow,
  dre,
  salesMargin,
} from "@/services/finance";
import { FinancePanel } from "@/components/admin/FinancePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro" };

export default async function FinancePage() {
  await requirePagePermission("finance.read");

  // primeira visita: cria contas/categorias padrão (idempotente).
  // A partir daqui, vendas pagas caem automaticamente na conta certa.
  await ensureFinanceDefaults();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = now;

  const [balances, flow, dreData, margin, accounts, categories, payablesRaw] = await Promise.all([
    accountBalances(),
    cashFlow({ from, to }),
    dre({ from, to }),
    salesMargin({ from, to }),
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.financialCategory.findMany({ where: { active: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.financialEntry.findMany({
      where: { direction: "EXPENSE", status: "PENDING" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 200,
      select: {
        id: true,
        description: true,
        amountCents: true,
        dueDate: true,
        supplierId: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  // resolve nomes de fornecedor das contas a pagar
  const supplierIds = [...new Set(payablesRaw.map((p) => p.supplierId).filter(Boolean) as string[])];
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
    : [];
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const payables = payablesRaw.map((p) => ({
    id: p.id,
    description: p.description,
    amountCents: p.amountCents,
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    category: p.category?.name ?? null,
    supplier: p.supplierId ? supplierName.get(p.supplierId) ?? null : null,
  }));

  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Financeiro</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Contas a pagar, fluxo de caixa e resultado de <span className="capitalize">{monthLabel}</span>.
          As vendas pagas entram automaticamente.
        </p>
      </div>

      <FinancePanel
        balances={balances}
        summary={{
          incomeCents: flow.incomeCents,
          expenseCents: flow.expenseCents,
          netCents: flow.netCents,
          revenueCents: margin.revenueCents,
          cogsCents: margin.cogsCents,
          grossProfitCents: margin.grossProfitCents,
        }}
        cashflowDays={flow.days}
        dre={dreData}
        payables={payables}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
      />
    </div>
  );
}
