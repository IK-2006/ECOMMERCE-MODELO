"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

interface Quote {
  carrier: string;
  service: string;
  serviceName: string;
  priceCents: number;
  days: number;
}

/** Calculadora de frete usada na página de produto. */
export function ShippingCalculator({ productId }: { productId: string }) {
  const [cep, setCep] = useState("");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setQuotes(null);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep, productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao calcular frete");
      if (data.quotes.length === 0) {
        setError("Nenhuma opção de entrega disponível para este CEP.");
      } else {
        setQuotes(data.quotes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao calcular frete");
    } finally {
      setLoading(false);
    }
  };

  const maskCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  return (
    <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        Calcular frete e prazo
      </p>
      <form onSubmit={calculate} className="mt-3 flex gap-2">
        <input
          value={cep}
          onChange={(e) => setCep(maskCep(e.target.value))}
          placeholder="00000-000"
          inputMode="numeric"
          className="h-10 w-36 border border-zinc-300 bg-transparent px-3 text-sm tracking-wide outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        <button
          type="submit"
          disabled={loading || cep.replace(/\D/g, "").length !== 8}
          className="flex h-10 items-center border border-zinc-900 px-5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-30 dark:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
        >
          {loading ? <Spinner className="size-4" /> : "Calcular"}
        </button>
      </form>
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-[11px] tracking-wide text-zinc-400 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
      >
        Não sei meu CEP
      </a>

      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {quotes && (
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {quotes.map((q) => (
            <li key={q.service} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">{q.serviceName}</span>
              <span className="text-xs text-zinc-400">
                {q.carrier === "RETIRADA"
                  ? `pronto em até ${q.days} dia${q.days > 1 ? "s" : ""} · `
                  : `até ${q.days} dia${q.days > 1 ? "s" : ""} úteis · `}
                <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                  {q.priceCents === 0 ? "Grátis" : formatCurrency(q.priceCents)}
                </strong>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
