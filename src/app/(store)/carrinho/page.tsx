"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { QuantityInput } from "@/components/store/QuantityInput";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const { status } = useSession();
  const router = useRouter();

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="skeleton h-9 w-48" />
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <EmptyState
          icon="◇"
          title="Seu carrinho está vazio"
          description="Explore nossas peças e encontre algo especial."
          action={
            <Link href="/produtos">
              <Button>Ver produtos</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const goToCheckout = () => {
    if (status !== "authenticated") {
      router.push(`/entrar?callbackUrl=${encodeURIComponent("/checkout")}`);
    } else {
      router.push("/checkout");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">Carrinho</h1>
      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
        {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "itens"}
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
        <ul>
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-5 border-t border-zinc-200 py-6 first:border-t-0 first:pt-0 dark:border-zinc-800"
            >
              <Link
                href={`/produto/${item.slug}`}
                className="block w-24 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 sm:w-28"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} className="aspect-[3/4] size-full object-cover" />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center text-2xl">💎</div>
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/produto/${item.slug}`}
                      className="text-sm leading-snug transition-colors hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    {item.variantName && (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                        {item.variantName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label="Remover item"
                    className="p-1.5 text-zinc-300 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {item.quantity > item.stock && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Apenas {item.stock} em estoque — ajuste a quantidade
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-4">
                  <QuantityInput
                    value={item.quantity}
                    onChange={(q) => updateItem(item.id, q)}
                    max={Math.min(99, Math.max(1, item.stock))}
                  />
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(item.unitPriceCents * item.quantity)}
                    </p>
                    {item.quantity > 1 && (
                      <p className="text-[11px] text-zinc-400">
                        {formatCurrency(item.unitPriceCents)} cada
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* resumo */}
        <aside className="h-fit border border-zinc-200 p-7 dark:border-zinc-800 lg:sticky lg:top-32">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em]">Resumo</h2>
          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-medium">{formatCurrency(cart.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Frete</dt>
              <dd className="text-xs text-zinc-400">calculado no checkout</dd>
            </div>
          </dl>
          <hr className="my-5 border-zinc-200 dark:border-zinc-800" />
          <div className="flex justify-between text-base font-medium">
            <span>Total</span>
            <span>{formatCurrency(cart.subtotalCents)}</span>
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={goToCheckout}>
            Finalizar compra
          </Button>
          <Link
            href="/produtos"
            className="mt-4 block text-center text-[11px] uppercase tracking-[0.14em] text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
          >
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
