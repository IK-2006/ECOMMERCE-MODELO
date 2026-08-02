"use client";

import Link from "next/link";
import { useConsent } from "@/components/providers/ConsentProvider";

/**
 * Banner de consentimento de cookies (LGPD). Só aparece enquanto o
 * visitante não decidiu. Enquanto "Recusar" ou sem decisão, nenhum
 * rastreamento de marketing (Pixel/GA) é carregado.
 */
export function ConsentBanner() {
  const { consent, grant, deny } = useConsent();

  if (consent !== null) return null;

  return (
    <div className="animate-slide-up fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/95 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          Usamos cookies para melhorar sua experiência e medir nossos anúncios. Você pode
          aceitar ou recusar.{" "}
          <Link
            href="/politica-de-privacidade"
            className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Saiba mais
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={deny}
            className="h-9 border border-zinc-300 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Recusar
          </button>
          <button
            onClick={grant}
            className="h-9 bg-zinc-900 px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
