"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { maskPhone, maskCpf } from "@/lib/masks";

export function ProfileForms({
  initial,
}: {
  initial: { name: string; email: string; phone: string; cpf: string; hasPassword: boolean };
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(maskPhone(initial.phone));
  const [cpf, setCpf] = useState(maskCpf(initial.cpf));
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, cpf }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Dados atualizados!");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao alterar senha", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-10">
      <form onSubmit={saveProfile} className="space-y-4 border border-zinc-200 p-7 dark:border-zinc-800">
        <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Dados pessoais</h2>
        <Input label="E-mail" value={initial.email} disabled hint="O e-mail não pode ser alterado" />
        <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
          <Input label="CPF" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
        </div>
        <Button type="submit" loading={savingProfile}>Salvar alterações</Button>
      </form>

      {initial.hasPassword && (
        <form onSubmit={changePassword} className="space-y-4 border border-zinc-200 p-7 dark:border-zinc-800">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Alterar senha</h2>
          <Input
            label="Senha atual"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            hint="Mínimo 8 caracteres, com letras e números"
          />
          <Button type="submit" variant="outline" loading={savingPassword}>Alterar senha</Button>
        </form>
      )}
    </div>
  );
}
