"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // resposta é sempre 200 (não revela se o e-mail existe)
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Recuperar senha</h1>

      {sent ? (
        <div className="mt-10 border border-emerald-200 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Se existir uma conta com o e-mail <strong>{email}</strong>, enviamos um
          link de redefinição de senha válido por 1 hora.
          <br />
          <span className="mt-2 block text-xs opacity-75">
            Dica (dev): sem SMTP configurado, o link aparece no console do servidor.
          </span>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-zinc-500">
            Informe seu e-mail e enviaremos um link para redefinir a senha.
          </p>
          <form onSubmit={submit} className="mt-10 space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@email.com"
            />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Enviar link de recuperação
            </Button>
          </form>
        </>
      )}

      <p className="mt-8 text-center">
        <Link
          href="/entrar"
          className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
