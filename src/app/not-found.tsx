import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-7xl font-black text-zinc-200 dark:text-zinc-800">404</p>
      <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        O endereço que você tentou acessar não existe ou foi removido.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
      >
        Voltar para a loja
      </Link>
    </div>
  );
}
