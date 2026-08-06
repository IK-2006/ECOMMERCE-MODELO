"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { roleHasPermission, type Permission } from "@/lib/permissions";

// ícones de linha finos (mesmo estilo do Header da loja: strokeWidth 1.5)
const ICONS: Record<string, string> = {
  dashboard:
    "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 8.25V6zM13.5 6A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  pdv: "M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
  pedidos:
    "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
  reembolsos: "M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3",
  produtos:
    "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z",
  categorias:
    "M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0A2.25 2.25 0 004.5 9v.878m1.5-3c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128M18 6.878A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122",
  clientes:
    "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  cupons:
    "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z",
  frete:
    "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12",
  estoque:
    "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",
  fornecedores:
    "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  usuarios:
    "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  compras:
    "M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
};

// Cada item declara a permissão mínima para aparecer. O menu é filtrado
// pelo papel do usuário (ver src/lib/permissions.ts).
const links: { href: string; label: string; icon: string; perm: Permission }[] = [
  { href: "/admin", label: "Visão Geral", icon: "dashboard", perm: "dashboard.view" },
  { href: "/admin/pdv", label: "Venda em Loja", icon: "pdv", perm: "pos.operate" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "pedidos", perm: "orders.read" },
  { href: "/admin/reembolsos", label: "Reembolsos", icon: "reembolsos", perm: "refunds.manage" },
  { href: "/admin/produtos", label: "Produtos", icon: "produtos", perm: "products.read" },
  { href: "/admin/categorias", label: "Categorias", icon: "categorias", perm: "products.write" },
  { href: "/admin/estoque", label: "Estoque", icon: "estoque", perm: "stock.read" },
  { href: "/admin/fornecedores", label: "Fornecedores", icon: "fornecedores", perm: "suppliers.write" },
  { href: "/admin/compras", label: "Compras", icon: "compras", perm: "purchases.read" },
  { href: "/admin/clientes", label: "Clientes", icon: "clientes", perm: "customers.read" },
  { href: "/admin/cupons", label: "Cupons", icon: "cupons", perm: "coupons.write" },
  { href: "/admin/frete", label: "Frete", icon: "frete", perm: "shipping.manage" },
  { href: "/admin/usuarios", label: "Usuários", icon: "usuarios", perm: "users.manage" },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      className="size-[18px] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link href="/admin" className="flex items-baseline gap-2.5">
      <span
        className={cn(
          "font-serif uppercase tracking-[0.3em] text-zinc-900 dark:text-zinc-100",
          small ? "text-base" : "text-lg"
        )}
      >
        Gata Fit
      </span>
      <span className="text-[9px] uppercase tracking-[0.25em] text-accent">Painel</span>
    </Link>
  );
}

export function AdminSidebar({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  // só mostra os itens que o papel pode acessar
  const visibleLinks = links.filter((link) => roleHasPermission(role, link.perm));

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <>
      {/* barra mobile */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 lg:hidden print:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Wordmark small />
      </div>
      <div className="h-14 lg:hidden" />

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-zinc-200 bg-white transition-transform dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-100 px-5 dark:border-zinc-900">
          <Wordmark />
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {visibleLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 border-l-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "border-accent bg-accent-soft/60 font-medium text-accent dark:bg-accent-soft-dark/60"
                    : "border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                <Icon path={ICONS[link.icon]} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            {userName}
          </p>
          <div className="flex flex-col gap-1">
            <button
              onClick={toggle}
              className="flex items-center gap-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {theme === "dark" ? (
                <svg className="size-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
                </svg>
              ) : (
                <svg className="size-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.75 15.5A9.72 9.72 0 0112 21.75 9.75 9.75 0 018.5 2.9a.75.75 0 01.94.98 8.25 8.25 0 0010.87 10.68.75.75 0 01.94.94z" />
                </svg>
              )}
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </button>
            <Link
              href="/"
              className="flex items-center gap-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <svg className="size-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Ver loja
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
            >
              <svg className="size-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
