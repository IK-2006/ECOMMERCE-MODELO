"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const adminExpired = searchParams.get("expirado") === "admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      totp,
      redirect: false,
    });

    if (result?.error) {
      if (result.error === "2FA_REQUIRED") {
        // senha correta — pedir o código do app autenticador
        setNeeds2fa(true);
        setError(null);
      } else if (result.error === "CredentialsSignin") {
        setError("E-mail ou senha incorretos");
      } else {
        setError(result.error);
      }
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Entrar</h1>
      <p className="mt-3 text-sm text-zinc-500">
        Bem-vindo de volta. Acesse sua conta para continuar.
      </p>

      {adminExpired && (
        <p className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Sua sessão de administrador expirou por segurança. Faça login novamente para
          continuar no painel.
        </p>
      )}

      <form onSubmit={submit} className="mt-10 space-y-4">
        {error && (
          <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={needs2fa}
          autoComplete="email"
          placeholder="voce@email.com"
        />
        <div>
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={needs2fa}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Link
            href="/recuperar-senha"
            className="mt-2 inline-block text-[11px] uppercase tracking-[0.12em] text-zinc-400 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
          >
            Esqueci minha senha
          </Link>
        </div>

        {needs2fa && (
          <div className="animate-fade-in border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="mb-3 text-xs text-zinc-500">
              Esta conta tem verificação em duas etapas. Digite o código de 6
              dígitos do seu app autenticador.
            </p>
            <Input
              label="Código de verificação"
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              className="text-center text-lg tracking-[0.4em]"
            />
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {needs2fa ? "Verificar e entrar" : "Entrar"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Ainda não tem conta?{" "}
        <Link
          href={`/cadastro?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Cadastre-se grátis
        </Link>
      </p>

      <div className="mt-10 border border-zinc-200 p-4 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800">
        <p className="font-medium uppercase tracking-[0.12em]">Contas de demonstração</p>
        <p className="mt-2">Cliente — <code>cliente@teste.com</code> / <code>cliente123</code></p>
        <p>Admin — <code>admin@loja.com</code> / <code>admin123</code></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
