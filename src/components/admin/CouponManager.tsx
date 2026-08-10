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
import { filterMoneyInput } from "@/lib/masks";

interface CouponView {
  id: string;
  code: string;
  description: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  percent: number | null;
  valueCents: number | null;
  minOrderCents: number | null;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: string;
  expiresAt: string;
  active: boolean;
}

interface CouponFormState {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  percent: string;
  value: string;
  minOrder: string;
  maxUses: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  active: boolean;
}

const emptyForm: CouponFormState = {
  code: "",
  description: "",
  type: "PERCENT",
  percent: "10",
  value: "",
  minOrder: "",
  maxUses: "",
  perUserLimit: "",
  startsAt: "",
  expiresAt: "",
  active: true,
};

const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100);

export function CouponManager({ coupons }: { coupons: CouponView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: CouponView) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description,
      type: c.type,
      percent: c.percent ? String(c.percent) : "",
      value: c.valueCents ? (c.valueCents / 100).toFixed(2).replace(".", ",") : "",
      minOrder: c.minOrderCents ? (c.minOrderCents / 100).toFixed(2).replace(".", ",") : "",
      maxUses: c.maxUses ? String(c.maxUses) : "",
      perUserLimit: c.perUserLimit ? String(c.perUserLimit) : "",
      startsAt: c.startsAt,
      expiresAt: c.expiresAt,
      active: c.active,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code.toUpperCase(),
        description: form.description,
        type: form.type,
        percent: form.type === "PERCENT" ? Number(form.percent) || null : null,
        valueCents: form.type === "FIXED" && form.value ? toCents(form.value) : null,
        minOrderCents: form.minOrder ? toCents(form.minOrder) : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59` : null,
        active: form.active,
      };
      const res = await fetch(
        editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(editingId ? "Cupom atualizado!" : "Cupom criado!");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: CouponView) => {
    if (!confirm(`Excluir o cupom ${c.code}?`)) return;
    const res = await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast(data.deactivated ? "Cupom desativado (já usado em pedidos)" : "Cupom excluído", "info");
      router.refresh();
    } else {
      toast(data.error ?? "Erro ao excluir", "error");
    }
  };

  const describeDiscount = (c: CouponView) =>
    c.type === "PERCENT"
      ? `${c.percent}% OFF`
      : c.type === "FIXED"
        ? `${formatCurrency(c.valueCents ?? 0)} OFF`
        : "Frete grátis";

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={openNew}>+ Novo cupom</Button>
      </div>

      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Código</th>
              <th className="p-4 font-medium">Desconto</th>
              <th className="p-4 font-medium">Pedido mínimo</th>
              <th className="p-4 font-medium">Usos</th>
              <th className="p-4 font-medium">Validade</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="p-4">
                  <p className="font-mono font-bold">{c.code}</p>
                  {c.description && <p className="text-xs text-zinc-400">{c.description}</p>}
                </td>
                <td className="p-4 font-medium">{describeDiscount(c)}</td>
                <td className="p-4 text-zinc-500">
                  {c.minOrderCents ? formatCurrency(c.minOrderCents) : "—"}
                </td>
                <td className="p-4">
                  {c.usedCount}
                  {c.maxUses ? ` / ${c.maxUses}` : ""}
                </td>
                <td className="p-4 text-zinc-500">
                  {c.expiresAt ? new Date(`${c.expiresAt}T12:00:00`).toLocaleDateString("pt-BR") : "Sem limite"}
                </td>
                <td className="p-4">
                  {c.active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Ativo</Badge>
                  ) : (
                    <Badge>Inativo</Badge>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-zinc-400">Nenhum cupom cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar cupom" : "Novo cupom"}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Código *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="BEMVINDO10"
              required
              className="font-mono uppercase"
            />
            <Select
              label="Tipo *"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CouponFormState["type"] })}
            >
              <option value="PERCENT">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
              <option value="FREE_SHIPPING">Frete grátis</option>
            </Select>
          </div>
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {form.type === "PERCENT" && (
              <Input
                label="Percentual (%) *"
                type="number"
                min={1}
                max={100}
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
                required
              />
            )}
            {form.type === "FIXED" && (
              <Input
                label="Valor (R$) *"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: filterMoneyInput(e.target.value) })}
                placeholder="20,00"
                required
                inputMode="decimal"
              />
            )}
            <Input
              label="Pedido mínimo (R$)"
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: filterMoneyInput(e.target.value) })}
              placeholder="Sem mínimo"
              inputMode="decimal"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Limite total de usos"
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              placeholder="Ilimitado"
            />
            <Input
              label="Limite por cliente"
              type="number"
              min={1}
              value={form.perUserLimit}
              onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
              placeholder="Ilimitado"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Início da validade"
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            <Input
              label="Fim da validade"
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-accent"
            />
            Cupom ativo
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
