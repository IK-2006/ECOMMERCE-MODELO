"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";

interface AccountRef { id: string; name: string; kind: string }
interface CategoryRef { id: string; name: string; type: string }
interface Payable {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string | null;
  category: string | null;
  supplier: string | null;
}
interface DreData {
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  income: { name: string; cents: number }[];
  expense: { name: string; cents: number }[];
}

const KIND_LABELS: Record<string, string> = { CAIXA: "Caixa", BANCO: "Banco", GATEWAY: "Gateway" };

/** "150,90" ou "150.90" → 15090 (centavos). */
function toCents(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

type Tab = "overview" | "payables" | "cashflow" | "dre" | "cadastros";

export function FinancePanel({
  balances,
  summary,
  cashflowDays,
  dre,
  payables,
  accounts,
  categories,
}: {
  balances: { id: string; name: string; kind: string; balanceCents: number }[];
  summary: {
    incomeCents: number;
    expenseCents: number;
    netCents: number;
    revenueCents: number;
    cogsCents: number;
    grossProfitCents: number;
  };
  cashflowDays: { date: string; incomeCents: number; expenseCents: number; netCents: number }[];
  dre: DreData;
  payables: Payable[];
  accounts: AccountRef[];
  categories: CategoryRef[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [busyId, setBusyId] = useState<string | null>(null);

  // modal: novo lançamento
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState({
    direction: "EXPENSE" as "INCOME" | "EXPENSE",
    description: "",
    amount: "",
    categoryId: "",
    dueDate: "",
    paidNow: false,
    accountId: "",
  });
  const [savingEntry, setSavingEntry] = useState(false);

  // modal: liquidar (marcar paga/recebida)
  const [settleTarget, setSettleTarget] = useState<Payable | null>(null);
  const [settleAccountId, setSettleAccountId] = useState("");

  const expenseCats = categories.filter((c) => c.type === "EXPENSE");
  const incomeCats = categories.filter((c) => c.type === "INCOME");

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = toCents(entry.amount);
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      toast("Informe um valor válido", "error");
      return;
    }
    setSavingEntry(true);
    try {
      const res = await fetch("/api/admin/finance/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: entry.direction,
          amountCents,
          description: entry.description,
          categoryId: entry.categoryId || undefined,
          dueDate: entry.dueDate || undefined,
          status: entry.paidNow ? "PAID" : "PENDING",
          accountId: entry.paidNow ? entry.accountId || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Lançamento criado!");
      setEntryOpen(false);
      setEntry({ direction: "EXPENSE", description: "", amount: "", categoryId: "", dueDate: "", paidNow: false, accountId: "" });
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSavingEntry(false);
    }
  };

  const submitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    if (!settleAccountId) {
      toast("Escolha a conta", "error");
      return;
    }
    setBusyId(settleTarget.id);
    try {
      const res = await fetch(`/api/admin/finance/entries/${settleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: settleAccountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Baixa registrada!");
      setSettleTarget(null);
      setSettleAccountId("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro", "error");
    } finally {
      setBusyId(null);
    }
  };

  const cancelEntry = async (id: string) => {
    if (!confirm("Cancelar este lançamento?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/finance/entries/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Lançamento cancelado", "info");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro", "error");
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Visão geral" },
    { key: "payables", label: `Contas a pagar${payables.length ? ` (${payables.length})` : ""}` },
    { key: "cashflow", label: "Fluxo de caixa" },
    { key: "dre", label: "DRE" },
    { key: "cadastros", label: "Cadastros" },
  ];

  const card = "rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div>
      {/* abas */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors ${
              tab === t.key
                ? "border-accent font-medium text-accent"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-end pb-1">
          <Button size="sm" onClick={() => setEntryOpen(true)}>+ Novo lançamento</Button>
        </div>
      </div>

      {/* VISÃO GERAL */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {balances.map((b) => (
              <div key={b.id} className={card}>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{b.name}</p>
                <p className="mt-2 text-xl font-bold">{formatCurrency(b.balanceCents)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">{KIND_LABELS[b.kind] ?? b.kind}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Entradas (mês)</p>
              <p className="mt-2 text-xl font-bold text-emerald-600">{formatCurrency(summary.incomeCents)}</p>
            </div>
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Saídas (mês)</p>
              <p className="mt-2 text-xl font-bold text-red-600">{formatCurrency(summary.expenseCents)}</p>
            </div>
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Resultado de caixa</p>
              <p className="mt-2 text-xl font-bold">{formatCurrency(summary.netCents)}</p>
            </div>
            <div className={card}>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Margem bruta (vendas − CMV)</p>
              <p className="mt-2 text-xl font-bold">{formatCurrency(summary.grossProfitCents)}</p>
              <p className="mt-1 text-[10px] text-zinc-400">
                Receita {formatCurrency(summary.revenueCents)} − CMV {formatCurrency(summary.cogsCents)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTAS A PAGAR */}
      {tab === "payables" && (
        <div className={`${card} p-0`}>
          {payables.length === 0 ? (
            <p className="p-10 text-center text-sm text-zinc-400">Nenhuma conta a pagar em aberto. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                    <th className="p-4 font-medium">Descrição</th>
                    <th className="p-4 font-medium">Fornecedor</th>
                    <th className="p-4 font-medium">Vencimento</th>
                    <th className="p-4 text-right font-medium">Valor</th>
                    <th className="p-4 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="p-4">{p.description}</td>
                      <td className="p-4 text-zinc-500">{p.supplier ?? "—"}</td>
                      <td className="p-4 text-zinc-500">
                        {p.dueDate ? new Date(p.dueDate).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-4 text-right font-medium">{formatCurrency(p.amountCents)}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setSettleTarget(p);
                              setSettleAccountId(accounts[0]?.id ?? "");
                            }}
                          >
                            Marcar paga
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => cancelEntry(p.id)}>
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FLUXO DE CAIXA */}
      {tab === "cashflow" && (
        <div className={`${card} p-0`}>
          {cashflowDays.length === 0 ? (
            <p className="p-10 text-center text-sm text-zinc-400">Sem movimentação realizada no mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                    <th className="p-4 font-medium">Dia</th>
                    <th className="p-4 text-right font-medium">Entradas</th>
                    <th className="p-4 text-right font-medium">Saídas</th>
                    <th className="p-4 text-right font-medium">Saldo do dia</th>
                  </tr>
                </thead>
                <tbody>
                  {cashflowDays.map((d) => (
                    <tr key={d.date} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="p-4">{new Date(`${d.date}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4 text-right text-emerald-600">{formatCurrency(d.incomeCents)}</td>
                      <td className="p-4 text-right text-red-600">{formatCurrency(d.expenseCents)}</td>
                      <td className="p-4 text-right font-medium">{formatCurrency(d.netCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DRE */}
      {tab === "dre" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-600">Receitas</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {dre.income.length === 0 && <li className="text-zinc-400">Sem receitas no período.</li>}
              {dre.income.map((r) => (
                <li key={r.name} className="flex justify-between">
                  <span>{r.name}</span>
                  <span className="font-medium">{formatCurrency(r.cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-red-600">Despesas</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {dre.expense.length === 0 && <li className="text-zinc-400">Sem despesas no período.</li>}
              {dre.expense.map((r) => (
                <li key={r.name} className="flex justify-between">
                  <span>{r.name}</span>
                  <span className="font-medium">{formatCurrency(r.cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${card} lg:col-span-2`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Resultado do período</span>
              <span className={`text-2xl font-bold ${dre.resultCents >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(dre.resultCents)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CADASTROS */}
      {tab === "cadastros" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Contas</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>{a.name}</span>
                  <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{KIND_LABELS[a.kind] ?? a.kind}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Categorias</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <Badge
                    className={
                      c.type === "INCOME"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    }
                  >
                    {c.type === "INCOME" ? "Receita" : "Despesa"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* MODAL: novo lançamento */}
      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title="Novo lançamento">
        <form onSubmit={submitEntry} className="space-y-4">
          <Select
            label="Tipo"
            value={entry.direction}
            onChange={(e) => setEntry({ ...entry, direction: e.target.value as "INCOME" | "EXPENSE", categoryId: "" })}
          >
            <option value="EXPENSE">Despesa (saída)</option>
            <option value="INCOME">Receita (entrada)</option>
          </Select>
          <Input
            label="Descrição *"
            value={entry.description}
            onChange={(e) => setEntry({ ...entry, description: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor (R$) *"
              inputMode="decimal"
              placeholder="0,00"
              value={entry.amount}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
              required
            />
            <Input
              label="Vencimento"
              type="date"
              value={entry.dueDate}
              onChange={(e) => setEntry({ ...entry, dueDate: e.target.value })}
            />
          </div>
          <Select
            label="Categoria"
            value={entry.categoryId}
            onChange={(e) => setEntry({ ...entry, categoryId: e.target.value })}
          >
            <option value="">— sem categoria —</option>
            {(entry.direction === "EXPENSE" ? expenseCats : incomeCats).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={entry.paidNow}
              onChange={(e) => setEntry({ ...entry, paidNow: e.target.checked, accountId: accounts[0]?.id ?? "" })}
              className="accent-accent"
            />
            Já foi {entry.direction === "EXPENSE" ? "pago" : "recebido"} (lançar como realizado)
          </label>
          {entry.paidNow && (
            <Select
              label="Conta *"
              value={entry.accountId}
              onChange={(e) => setEntry({ ...entry, accountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={savingEntry}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: liquidar conta a pagar */}
      <Modal open={!!settleTarget} onClose={() => setSettleTarget(null)} title="Registrar baixa">
        <form onSubmit={submitSettle} className="space-y-4">
          <p className="text-sm text-zinc-500">
            {settleTarget?.description} — <strong>{settleTarget ? formatCurrency(settleTarget.amountCents) : ""}</strong>
          </p>
          <Select label="Conta de saída *" value={settleAccountId} onChange={(e) => setSettleAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" loading={busyId === settleTarget?.id}>Confirmar pagamento</Button>
            <Button type="button" variant="ghost" onClick={() => setSettleTarget(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
