"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";

export interface SupplierView {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  productCount: number;
}

const emptyForm = { name: "", cnpj: "", phone: "", email: "", notes: "", active: true };

export function SupplierManager({ suppliers }: { suppliers: SupplierView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (s: SupplierView) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      cnpj: s.cnpj ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      notes: s.notes ?? "",
      active: s.active,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/admin/suppliers/${editingId}` : "/api/admin/suppliers",
        { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(editingId ? "Fornecedor atualizado!" : "Fornecedor criado!");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: SupplierView) => {
    if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return;
    const res = await fetch(`/api/admin/suppliers/${s.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast(data.deactivated ? "Fornecedor desativado (tem histórico)" : "Fornecedor excluído", "info");
      router.refresh();
    } else {
      toast(data.error ?? "Erro ao excluir", "error");
    }
  };

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={openNew}>+ Novo fornecedor</Button>
      </div>

      {suppliers.length === 0 ? (
        <p className="rounded-none border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
          Nenhum fornecedor cadastrado. Cadastre para lançar entradas de mercadoria.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="p-4 font-medium">Fornecedor</th>
                <th className="p-4 font-medium">CNPJ</th>
                <th className="p-4 font-medium">Contato</th>
                <th className="p-4 font-medium">Produtos</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="p-4 font-medium">{s.name}</td>
                  <td className="p-4 text-zinc-500">{s.cnpj || "—"}</td>
                  <td className="p-4 text-zinc-500">{s.phone || s.email || "—"}</td>
                  <td className="p-4">{s.productCount}</td>
                  <td className="p-4">
                    {s.active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Ativo</Badge>
                    ) : (
                      <Badge>Inativo</Badge>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar fornecedor" : "Novo fornecedor"}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
            <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-accent" />
            Fornecedor ativo
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
