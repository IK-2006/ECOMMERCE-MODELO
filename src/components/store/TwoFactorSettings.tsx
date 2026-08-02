"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";

type Step = "idle" | "setup";

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQr(data.qr);
      setSecret(data.secret);
      setStep("setup");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao iniciar", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/account/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Verificação em duas etapas ativada!");
      setStep("idle");
      setToken("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao ativar", "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Verificação em duas etapas desativada", "info");
      setPassword("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao desativar", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border border-zinc-200 p-7 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.25em]">
          Verificação em duas etapas
        </h2>
        {enabled ? (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            Ativada
          </Badge>
        ) : (
          <Badge>Desativada</Badge>
        )}
      </div>
      <p className="text-sm text-zinc-500">
        Adiciona uma camada extra de segurança: além da senha, o login pede um
        código gerado por um app autenticador (Google Authenticator, Authy,
        Microsoft Authenticator).
      </p>

      {/* DESATIVADA — botão para ativar */}
      {!enabled && step === "idle" && (
        <Button variant="outline" onClick={startSetup} loading={busy}>
          Ativar 2FA
        </Button>
      )}

      {/* ENROLAMENTO — QR + confirmação */}
      {!enabled && step === "setup" && qr && (
        <form onSubmit={confirmEnable} className="space-y-4">
          <ol className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <li>
              <strong>1.</strong> Abra o app autenticador e escaneie o QR code:
              <div className="mt-2 inline-block bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code 2FA" width={200} height={200} />
              </div>
              {secret && (
                <p className="mt-1 text-xs text-zinc-400">
                  Ou digite manualmente:{" "}
                  <code className="select-all font-mono text-zinc-700 dark:text-zinc-300">
                    {secret}
                  </code>
                </p>
              )}
            </li>
            <li>
              <strong>2.</strong> Digite o código de 6 dígitos que aparece no app:
            </li>
          </ol>
          <Input
            label="Código de verificação"
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            className="max-w-40 text-center text-lg tracking-[0.4em]"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={token.length < 6}>
              Confirmar e ativar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("idle")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* ATIVADA — desativar com senha */}
      {enabled && (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-zinc-500">
            Para desativar, confirme sua senha:
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-56">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" variant="danger" loading={busy} disabled={!password}>
              Desativar 2FA
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
