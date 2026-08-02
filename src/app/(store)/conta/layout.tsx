import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?callbackUrl=/conta");

  const links = [
    { href: "/conta", label: "Meus dados" },
    { href: "/conta/pedidos", label: "Meus pedidos" },
    { href: "/conta/enderecos", label: "Endereços" },
    { href: "/favoritos", label: "Lista de desejos" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">Minha conta</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-6 overflow-x-auto border-b border-zinc-200 pb-3 dark:border-zinc-800 lg:flex-col lg:gap-1 lg:border-b-0 lg:pb-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
