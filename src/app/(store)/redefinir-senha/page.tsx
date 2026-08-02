"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao redefinir senha");
      toast("Senha redefinida! Faça login com a nova senha.");
      router.push("/entrar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p className="mt-10 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        Link inválido.{" "}
        <Link href="/recuperar-senha" className="underline">
          Solicite um novo link
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-4">
      {error && (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <Input
        label="Nova senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres, com letras e números"
      />
      <Input
        label="Confirmar nova senha"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Redefinir senha
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Redefinir senha</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
