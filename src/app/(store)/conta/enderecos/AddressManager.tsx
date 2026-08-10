"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCep, BR_STATES } from "@/lib/utils";
import { maskPhone } from "@/lib/masks";

interface AddressView {
  id: string;
  label: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  phone: string;
  isDefault: boolean;
}

const emptyForm: Omit<AddressView, "id"> = {
  label: "Casa",
  recipient: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "SP",
  phone: "",
  isDefault: false,
};

export function AddressManager({ initialAddresses }: { initialAddresses: AddressView[] }) {
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

  const openEdit = (addr: AddressView) => {
    setEditingId(addr.id);
    setForm({ ...addr, cep: formatCep(addr.cep), phone: maskPhone(addr.phone) });
    setModalOpen(true);
  };

  const maskCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const lookupCep = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          district: data.bairro || f.district,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch {
      /* preenchimento manual */
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/account/addresses/${editingId}` : "/api/account/addresses",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(editingId ? "Endereço atualizado!" : "Endereço adicionado!");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar endereço", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este endereço?")) return;
    const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Endereço removido", "info");
      router.refresh();
    } else {
      toast("Erro ao remover endereço", "error");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Endereços salvos</h2>
        <Button onClick={openNew}>Novo endereço</Button>
      </div>

      {initialAddresses.length === 0 ? (
        <EmptyState
          icon="◇"
          title="Nenhum endereço salvo"
          description="Adicione um endereço para agilizar suas compras."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {initialAddresses.map((addr) => (
            <div
              key={addr.id}
              className="border border-zinc-200 p-5 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{addr.label}</p>
                {addr.isDefault && (
                  <Badge className="bg-accent-soft text-accent dark:bg-accent-soft-dark">
                    Padrão
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-zinc-500">
                {addr.recipient}
                <br />
                {addr.street}, {addr.number}
                {addr.complement ? ` – ${addr.complement}` : ""}
                <br />
                {addr.district} · {addr.city}/{addr.state}
                <br />
                CEP {formatCep(addr.cep)}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(addr)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(addr.id)}>
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar endereço" : "Novo endereço"}
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Identificação"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Casa, Trabalho..."
            required
          />
          <Input
            label="Destinatário"
            value={form.recipient}
            onChange={(e) => setForm({ ...form, recipient: e.target.value })}
            required
          />
          <Input
            label="CEP"
            value={form.cep}
            onChange={(e) => {
              const masked = maskCep(e.target.value);
              setForm({ ...form, cep: masked });
              lookupCep(masked);
            }}
            placeholder="00000-000"
            inputMode="numeric"
            required
          />
          <Input
            label="Telefone (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
            placeholder="(11) 99999-9999"
            inputMode="tel"
          />
          <Input
            label="Rua / Avenida"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            className="sm:col-span-2"
            required
          />
          <Input
            label="Número"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            required
          />
          <Input
            label="Complemento"
            value={form.complement}
            onChange={(e) => setForm({ ...form, complement: e.target.value })}
          />
          <Input
            label="Bairro"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cidade"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
            <Select
              label="UF"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            >
              {BR_STATES.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            Definir como endereço padrão
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={saving}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
