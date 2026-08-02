"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";

interface PdvVariant {
  id: string;
  name: string;
  priceCents: number | null;
  stock: number;
}
interface PdvProduct {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number;
  image: string | null;
  stock: number;
  variants: PdvVariant[];
}
interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  unitPriceCents: number;
  quantity: number;
  maxStock: number;
}

type PaymentMethod = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";

const PAYMENTS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "dinheiro", label: "Dinheiro", icon: "💵" },
  { value: "pix", label: "Pix", icon: "⚡" },
  { value: "cartao_credito", label: "Crédito", icon: "💳" },
  { value: "cartao_debito", label: "Débito", icon: "🏦" },
];

const toCents = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

interface SaleResult {
  id: string;
  number: string;
  totalCents: number;
  changeCents: number | null;
}

export function PdvTerminal({ products }: { products: PdvProduct[] }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [discount, setDiscount] = useState("");
  const [received, setReceived] = useState("");
  const [variantPicker, setVariantPicker] = useState<PdvProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const subtotalCents = cart.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const discountCents = Math.min(Math.max(0, toCents(discount)), subtotalCents);
  const totalCents = subtotalCents - discountCents;
  const receivedCents = toCents(received);
  const changeCents = payment === "dinheiro" ? receivedCents - totalCents : 0;

  const addLine = (p: PdvProduct, v: PdvVariant | null) => {
    const key = v ? v.id : p.id;
    const maxStock = v ? v.stock : p.stock;
    if (maxStock <= 0) {
      toast("Produto sem estoque.", "error");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.quantity >= maxStock) {
          toast(`Só há ${maxStock} em estoque.`, "info");
          return prev;
        }
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          productId: p.id,
          variantId: v ? v.id : null,
          name: p.name,
          variantName: v ? v.name : null,
          unitPriceCents: v ? v.priceCents ?? p.priceCents : p.priceCents,
          quantity: 1,
          maxStock,
        },
      ];
    });
  };

  const pick = (p: PdvProduct) => {
    if (p.variants.length > 0) setVariantPicker(p);
    else addLine(p, null);
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.key !== key) return [l];
        const q = l.quantity + delta;
        if (q <= 0) return [];
        if (q > l.maxStock) {
          toast(`Só há ${l.maxStock} em estoque.`, "info");
          return [l];
        }
        return [{ ...l, quantity: q }];
      })
    );
  };

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const reset = () => {
    setCart([]);
    setPayment(null);
    setDiscount("");
    setReceived("");
    setResult(null);
    setQuery("");
  };

  const canFinish =
    cart.length > 0 &&
    !!payment &&
    !saving &&
    (payment !== "dinheiro" || received === "" || receivedCents >= totalCents);

  const finish = async () => {
    if (!payment || cart.length === 0) return;
    if (payment === "dinheiro" && received !== "" && receivedCents < totalCents) {
      toast("Valor recebido menor que o total.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          paymentMethod: payment,
          discountCents,
          amountReceivedCents:
            payment === "dinheiro" && received !== "" ? receivedCents : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registrar a venda");
      setResult(data as SaleResult);
      toast("Venda registrada!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao registrar a venda", "error");
    } finally {
      setSaving(false);
    }
  };

  // ---- Tela de confirmação ----
  if (result) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="rounded-none border border-emerald-200 bg-emerald-50 p-8 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="text-4xl">✅</div>
          <h2 className="mt-3 text-xl font-bold">Venda registrada!</h2>
          <p className="mt-1 font-mono text-sm text-zinc-500">{result.number}</p>
          <p className="mt-4 text-3xl font-bold">{formatCurrency(result.totalCents)}</p>
          {result.changeCents != null && result.changeCents > 0 && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Troco: <strong>{formatCurrency(result.changeCents)}</strong>
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <a href={`/admin/pdv/recibo/${result.id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">🖨️ Imprimir recibo</Button>
            </a>
            <Button onClick={reset} className="w-full">Nova venda</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* --- Catálogo --- */}
      <div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto por nome ou SKU..."
          autoFocus
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => {
            const soldOut = p.variants.length === 0 && p.stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => pick(p)}
                disabled={soldOut}
                className="flex flex-col overflow-hidden rounded-none border border-zinc-200 bg-white text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-accent"
              >
                <span className="aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col p-2.5">
                  <span className="line-clamp-2 text-xs font-medium">{p.name}</span>
                  <span className="mt-1 text-sm font-semibold">{formatCurrency(p.priceCents)}</span>
                  <span className="mt-0.5 text-[11px] text-zinc-400">
                    {p.variants.length > 0
                      ? `${p.variants.length} variações`
                      : soldOut
                        ? "Sem estoque"
                        : `${p.stock} em estoque`}
                  </span>
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-zinc-400">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      </div>

      {/* --- Carrinho / caixa --- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-semibold">Carrinho</h2>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-400">
                Clique nos produtos para adicionar.
              </p>
            ) : (
              cart.map((l) => (
                <div key={l.key} className="flex items-center gap-2 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    {l.variantName && <p className="text-xs text-zinc-400">{l.variantName}</p>}
                    <p className="text-xs text-zinc-500">{formatCurrency(l.unitPriceCents)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => changeQty(l.key, -1)}
                      className="flex size-7 items-center justify-center rounded-md border border-zinc-300 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{l.quantity}</span>
                    <button
                      onClick={() => changeQty(l.key, 1)}
                      className="flex size-7 items-center justify-center rounded-md border border-zinc-300 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {formatCurrency(l.unitPriceCents * l.quantity)}
                  </div>
                  <button
                    onClick={() => removeLine(l.key)}
                    className="text-zinc-400 hover:text-red-500"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">Desconto (R$)</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="h-9 w-28 rounded-lg border border-zinc-300 bg-white px-2 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex items-center justify-between text-sm text-emerald-600">
                <span>Desconto</span>
                <span>− {formatCurrency(discountCents)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(totalCents)}</span>
            </div>

            {/* Pagamento */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Forma de pagamento
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENTS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPayment(m.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors ${
                      payment === m.value
                        ? "border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark"
                        : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>{m.icon}</span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payment === "dinheiro" && (
              <div className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-500">Valor recebido</span>
                  <input
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="h-9 w-28 rounded-lg border border-zinc-300 bg-white px-2 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                {received !== "" && (
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Troco</span>
                    <span className={changeCents < 0 ? "text-red-500" : "text-emerald-600"}>
                      {formatCurrency(Math.max(0, changeCents))}
                      {changeCents < 0 && " (insuficiente)"}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button className="w-full" size="lg" loading={saving} disabled={!canFinish} onClick={finish}>
              Finalizar venda · {formatCurrency(totalCents)}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de seleção de variação */}
      <Modal
        open={!!variantPicker}
        onClose={() => setVariantPicker(null)}
        title={variantPicker ? `Escolha a variação · ${variantPicker.name}` : ""}
      >
        <div className="space-y-2">
          {variantPicker?.variants.map((v) => {
            const out = v.stock <= 0;
            return (
              <button
                key={v.id}
                disabled={out}
                onClick={() => {
                  addLine(variantPicker, v);
                  setVariantPicker(null);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-200 p-3 text-left text-sm transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800"
              >
                <span>
                  <span className="font-medium">{v.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">
                    {out ? "Sem estoque" : `${v.stock} em estoque`}
                  </span>
                </span>
                <span className="font-semibold">
                  {formatCurrency(v.priceCents ?? variantPicker.priceCents)}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
