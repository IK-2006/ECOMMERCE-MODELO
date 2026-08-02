"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  initialWished,
  large,
}: {
  productId: string;
  initialWished: boolean;
  large?: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [wished, setWished] = useState(initialWished);
  const [busy, setBusy] = useState(false);

  const toggleWishlist = async () => {
    if (status !== "authenticated") {
      router.push(`/entrar?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    // otimista
    setWished((w) => !w);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWished(data.wished);
      toast(data.wished ? "Adicionado à lista de desejos" : "Removido da lista de desejos", "info");
    } catch {
      setWished((w) => !w); // desfaz
      toast("Não foi possível atualizar a lista de desejos", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggleWishlist}
      disabled={busy}
      aria-label={wished ? "Remover da lista de desejos" : "Adicionar à lista de desejos"}
      className={cn(
        "flex items-center justify-center rounded-full bg-white/90 shadow-md ring-1 ring-zinc-200 backdrop-blur transition-all hover:scale-110 dark:bg-zinc-900/90 dark:ring-zinc-700",
        large ? "size-11" : "size-9"
      )}
    >
      <svg
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className={cn(
          large ? "size-5" : "size-4",
          wished ? "fill-red-500 text-red-500" : "fill-none text-zinc-500 dark:text-zinc-300"
        )}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.6c0 5.05-6.63 9.57-8.61 10.8a.75.75 0 01-.78 0C9.63 18.17 3 13.65 3 8.6a4.85 4.85 0 018.4-3.32L12 5.9l.6-.63A4.85 4.85 0 0121 8.6z"
        />
      </svg>
    </button>
  );
}
