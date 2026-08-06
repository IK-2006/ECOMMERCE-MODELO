"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  twoFactorEnabled: boolean;
  pendingInvite: boolean;
  createdAt: string;
}

// Papéis oferecidos na tela. ADMIN só aparece se o próprio ator for ADMIN.
const BASE_ROLES: Role[] = ["GERENTE", "CAIXA", "ESTOQUISTA", "FINANCEIRO"];

export function UserManager({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: UserView[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserView | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; role: Role }>({
    name: "",
    email: "",
    role: "CAIXA",
  });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN";
  const assignableRoles: Role[] = isAdmin ? ["ADMIN", ...BASE_ROLES] : [...BASE_ROLES];
  // ator não-admin não gerencia contas ADMIN
  const canManage = (u: UserView) => isAdmin || u.role !== "ADMIN";

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", role: "CAIXA" });
    setModalOpen(true);
  };
  const openEdit = (u: UserView) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role as Role });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const editingSelf = editing?.id === currentUserId;
      const payload = editing
        ? { name: form.name, ...(editingSelf ? {} : { role: form.role }) } // não muda o próprio papel
        : form;
      const res = await fetch(editing ? `/api/admin/users/${editing.id}` : "/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(editing ? "Usuário atualizado!" : "Convite enviado por e-mail!");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (u: UserView, active: boolean) => {
    if (!active && !confirm(`Desativar o acesso de "${u.name}"?`)) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(active ? "Usuário reativado" : "Usuário desativado", "info");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao atualizar", "error");
    } finally {
      setBusyId(null);
    }
  };

  const resendInvite = async (u: UserView) => {
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Convite reenviado por e-mail!");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao reenviar", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <Button onClick={openNew}>+ Novo usuário</Button>
      </div>

      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">E-mail</th>
              <th className="p-4 font-medium">Papel</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              const manageable = canManage(u);
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="p-4 font-medium">
                    {u.name}
                    {self && <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400">(você)</span>}
                  </td>
                  <td className="p-4 text-zinc-500">{u.email}</td>
                  <td className="p-4">
                    <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {ROLE_LABELS[u.role as Role] ?? u.role}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {!u.active ? (
                      <Badge>Inativo</Badge>
                    ) : u.pendingInvite ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Convite pendente
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        Ativo
                      </Badge>
                    )}
                    {u.twoFactorEnabled && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400">2FA</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {manageable && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)} disabled={busy}>
                          Editar
                        </Button>
                      )}
                      {manageable && u.pendingInvite && u.active && (
                        <Button size="sm" variant="ghost" onClick={() => resendInvite(u)} disabled={busy}>
                          Reenviar convite
                        </Button>
                      )}
                      {manageable && !self && (
                        u.active ? (
                          <Button size="sm" variant="ghost" onClick={() => setActive(u, false)} disabled={busy}>
                            Desativar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setActive(u, true)} disabled={busy}>
                            Reativar
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuário" : "Novo usuário"}>
        <form onSubmit={save} className="space-y-4">
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="E-mail *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={!!editing}
            hint={editing ? "O e-mail não pode ser alterado." : "O convite para definir a senha será enviado a este e-mail."}
            required
          />
          <Select
            label="Papel *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            disabled={editing?.id === currentUserId}
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          {editing?.id === currentUserId && (
            <p className="text-xs text-zinc-500">Você não pode alterar o seu próprio papel.</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={saving}>
              {editing ? "Salvar" : "Enviar convite"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
