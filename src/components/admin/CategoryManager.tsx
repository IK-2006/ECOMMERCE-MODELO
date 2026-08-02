"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import { slugify } from "@/lib/utils";

interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string;
  position: number;
  active: boolean;
  productCount: number;
}

const emptyForm = { name: "", slug: "", description: "", position: 0, active: true };

export function CategoryManager({ categories }: { categories: CategoryView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, position: categories.length });
    setModalOpen(true);
  };

  const openEdit = (c: CategoryView) => {
    setEditingId(c.id);
    setForm({ name: c.name, slug: c.slug, description: c.description, position: c.position, active: c.active });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, slug: form.slug || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(editingId ? "Categoria atualizada!" : "Categoria criada!");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: CategoryView) => {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast("Categoria excluída", "info");
      router.refresh();
    } else {
      toast(data.error ?? "Erro ao excluir", "error");
    }
  };

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={openNew}>+ Nova categoria</Button>
      </div>

      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">Slug</th>
              <th className="p-4 font-medium">Produtos</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4 text-zinc-500">/{c.slug}</td>
                <td className="p-4">{c.productCount}</td>
                <td className="p-4">
                  {c.active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Ativa</Badge>
                  ) : (
                    <Badge>Inativa</Badge>
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
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar categoria" : "Nova categoria"}>
        <form onSubmit={save} className="space-y-4">
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={form.name ? slugify(form.name) : "gerado-automaticamente"}
          />
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Posição (ordem de exibição)"
            type="number"
            min={0}
            value={form.position}
            onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-accent"
            />
            Categoria ativa
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
