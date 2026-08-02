"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useCart } from "@/components/providers/CartProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

interface CategoryLink {
  name: string;
  slug: string;
}

export function Header({ categories }: { categories: CategoryLink[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { cart } = useCart();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(query.trim() ? `/produtos?q=${encodeURIComponent(query.trim())}` : "/produtos");
    setMobileOpen(false);
  };

  const cartCount = cart?.totalQuantity ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* menu mobile */}
        <button
          className="p-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link href="/" className="shrink-0">
          <span className="font-serif text-2xl font-medium uppercase tracking-[0.35em] text-zinc-900 dark:text-zinc-100">
            Gata Fit
          </span>
          <span className="ml-3 hidden text-[9px] font-normal uppercase tracking-[0.25em] text-zinc-400 xl:inline">
            Moda Feminina
          </span>
        </Link>

        {/* busca desktop — linha minimalista */}
        <form onSubmit={submitSearch} className="hidden flex-1 justify-center lg:flex">
          <div className="relative w-64">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="w-full border-0 border-b border-zinc-300 bg-transparent py-1.5 pr-7 text-sm tracking-wide outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
            </button>
          </div>
        </form>

        <div className="ml-auto flex items-center gap-0.5">
          {/* dark mode */}
          <button
            onClick={toggle}
            aria-label="Alternar tema"
            className="p-2 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {theme === "dark" ? (
              <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
              </svg>
            ) : (
              <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 15.5A9.72 9.72 0 0112 21.75 9.75 9.75 0 018.5 2.9a.75.75 0 01.94.98 8.25 8.25 0 0010.87 10.68.75.75 0 01.94.94z" />
              </svg>
            )}
          </button>

          {/* favoritos */}
          <Link
            href="/favoritos"
            aria-label="Lista de desejos"
            className="p-2 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.6c0 5.05-6.63 9.57-8.61 10.8a.75.75 0 01-.78 0C9.63 18.17 3 13.65 3 8.6a4.85 4.85 0 018.4-3.32L12 5.9l.6-.63A4.85 4.85 0 0121 8.6z" />
            </svg>
          </Link>

          {/* carrinho */}
          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className="relative p-2 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.36-1.7l1.26 12a1.88 1.88 0 01-1.87 2.07H5a1.88 1.88 0 01-1.87-2.07l1.26-12a1.88 1.88 0 011.87-1.68h11.53a1.88 1.88 0 011.87 1.68z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 top-0 flex size-4 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {cartCount > 99 ? "99" : cartCount}
              </span>
            )}
          </Link>

          {/* usuário */}
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-label="Minha conta"
                className="flex items-center gap-2 p-2 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.12a7.5 7.5 0 0115 0A17.93 17.93 0 0112 21.75c-2.68 0-5.22-.58-7.5-1.63z" />
                </svg>
                <span className="hidden max-w-24 truncate text-xs tracking-wide sm:block">
                  {session.user.name?.split(" ")[0]}
                </span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="animate-fade-in absolute right-0 z-20 mt-2 w-56 border border-zinc-200 bg-white py-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                    <MenuLink href="/conta" onClick={() => setUserMenuOpen(false)}>Minha conta</MenuLink>
                    <MenuLink href="/conta/pedidos" onClick={() => setUserMenuOpen(false)}>Meus pedidos</MenuLink>
                    <MenuLink href="/favoritos" onClick={() => setUserMenuOpen(false)}>Lista de desejos</MenuLink>
                    {session.user.role === "ADMIN" && (
                      <MenuLink href="/admin" onClick={() => setUserMenuOpen(false)}>
                        <span className="text-accent">Painel admin</span>
                      </MenuLink>
                    )}
                    <hr className="my-2 border-zinc-100 dark:border-zinc-800" />
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="block w-full px-4 py-2 text-left text-xs uppercase tracking-[0.12em] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/entrar"
              className="ml-2 hidden h-9 items-center bg-zinc-900 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:flex"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>

      {/* nav de categorias desktop */}
      <nav className="hidden border-t border-zinc-100 dark:border-zinc-900 lg:block">
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-center gap-10 px-6">
          <Link
            href="/produtos"
            className="text-[11px] uppercase tracking-[0.18em] text-zinc-900 underline-offset-8 transition-all hover:underline dark:text-zinc-100"
          >
            Todos
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/produtos?categoria=${c.slug}`}
              className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 underline-offset-8 transition-all hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* menu mobile expandido */}
      <div
        className={cn(
          "overflow-hidden border-t border-zinc-100 transition-all duration-300 dark:border-zinc-900 lg:hidden",
          mobileOpen ? "max-h-[440px]" : "max-h-0 border-t-0"
        )}
      >
        <div className="space-y-4 p-5">
          <form onSubmit={submitSearch}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="w-full border-0 border-b border-zinc-300 bg-transparent py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </form>
          <nav className="flex flex-col gap-1">
            <Link
              href="/produtos"
              onClick={() => setMobileOpen(false)}
              className="py-2 text-xs uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100"
            >
              Todos os produtos
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/produtos?categoria=${c.slug}`}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
              >
                {c.name}
              </Link>
            ))}
            {!session?.user && (
              <Link
                href="/entrar"
                onClick={() => setMobileOpen(false)}
                className="mt-3 flex h-11 items-center justify-center bg-zinc-900 text-[11px] font-medium uppercase tracking-[0.14em] text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Entrar / Cadastrar
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-xs uppercase tracking-[0.12em] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {children}
    </Link>
  );
}
