"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency, formatCep } from "@/lib/utils";
import { filterMoneyInput, maskCep } from "@/lib/masks";

interface RuleView {
  id: string;
  name: string;
  service: "PAC" | "SEDEX";
  cepStart: string;
  cepEnd: string;
  minWeightGrams: number;
  maxWeightGrams: number;
  priceCents: number;
  days: number;
  active: boolean;
}

interface RuleFormState {
  name: string;
  service: "PAC" | "SEDEX";
  cepStart: string;
  cepEnd: string;
  minWeightGrams: number;
  maxWeightGrams: number;
  price: string;
  days: number;
  active: boolean;
}

const emptyForm: RuleFormState = {
  name: "",
  service: "PAC",
  cepStart: "01000-000",
  cepEnd: "99999-999",
  minWeightGrams: 0,
  maxWeightGrams: 30000,
  price: "",
  days: 7,
  active: true,
};

export function ShippingRuleManager({ rules }: { rules: RuleView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (r: RuleView) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      service: r.service,
      cepStart: formatCep(r.cepStart),
      cepEnd: formatCep(r.cepEnd),
      minWeightGrams: r.minWeightGrams,
      maxWeightGrams: r.maxWeightGrams,
      price: (r.priceCents / 100).toFixed(2).replace(".", ","),
      days: r.days,
      active: r.active,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        service: form.service,
        cepStart: form.cepStart,
        cepEnd: form.cepEnd,
        minWeightGrams: Number(form.minWeightGrams),
        maxWeightGrams: Number(form.maxWeightGrams),
        priceCents: Math.round(parseFloat(form.price.replace(",", ".")) * 100),
        days: Number(form.days),
        active: form.active,
      };
      const res = await fetch(
        editingId ? `/api/admin/shipping-rules/${editingId}` : "/api/admin/shipping-rules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(editingId ? "Regra atualizada!" : "Regra criada!");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: RuleView) => {
    if (!confirm(`Excluir a regra "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/shipping-rules/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Regra excluída", "info");
      router.refresh();
    } else {
      toast("Erro ao excluir", "error");
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold">Tabela de frete interna</h2>
        <Button onClick={openNew}>+ Nova regra</Button>
      </div>

      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Regra</th>
              <th className="p-4 font-medium">Serviço</th>
              <th className="p-4 font-medium">Faixa de CEP</th>
              <th className="p-4 font-medium">Peso (g)</th>
              <th className="p-4 font-medium">Preço</th>
              <th className="p-4 font-medium">Prazo</th>
              <th className="p-4 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="p-4">
                  <p className="font-medium">{r.name}</p>
                  {!r.active && <Badge>Inativa</Badge>}
                </td>
                <td className="p-4">{r.service}</td>
                <td className="p-4 text-zinc-500">
                  {formatCep(r.cepStart)} – {formatCep(r.cepEnd)}
                </td>
                <td className="p-4 text-zinc-500">
                  {r.minWeightGrams} – {r.maxWeightGrams}
                </td>
                <td className="p-4 font-medium">{formatCurrency(r.priceCents)}</td>
                <td className="p-4">{r.days} dias úteis</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-zinc-400">
                  Nenhuma regra cadastrada — o checkout não conseguirá calcular frete
                  sem regras (ou credenciais dos Correios).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar regra" : "Nova regra de frete"}>
        <form onSubmit={save} className="space-y-4">
          <Input
            label="Nome da regra *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sudeste — PAC até 1kg"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Serviço *"
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value as "PAC" | "SEDEX" })}
            >
              <option value="PAC">PAC (econômico)</option>
              <option value="SEDEX">SEDEX (expresso)</option>
            </Select>
            <Input
              label="Prazo (dias úteis) *"
              type="number"
              min={1}
              max={60}
              value={form.days}
              onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="CEP inicial *"
              value={form.cepStart}
              onChange={(e) => setForm({ ...form, cepStart: maskCep(e.target.value) })}
              placeholder="01000-000"
              inputMode="numeric"
              required
            />
            <Input
              label="CEP final *"
              value={form.cepEnd}
              onChange={(e) => setForm({ ...form, cepEnd: maskCep(e.target.value) })}
              placeholder="39999-999"
              inputMode="numeric"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Peso mínimo (g)"
              type="number"
              min={0}
              value={form.minWeightGrams}
              onChange={(e) => setForm({ ...form, minWeightGrams: Number(e.target.value) })}
            />
            <Input
              label="Peso máximo (g)"
              type="number"
              min={1}
              value={form.maxWeightGrams}
              onChange={(e) => setForm({ ...form, maxWeightGrams: Number(e.target.value) })}
            />
          </div>
          <Input
            label="Preço (R$) *"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: filterMoneyInput(e.target.value) })}
            placeholder="19,90"
            required
            inputMode="decimal"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-accent"
            />
            Regra ativa
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
