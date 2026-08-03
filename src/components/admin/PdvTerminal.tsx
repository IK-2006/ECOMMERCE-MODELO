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

const PAYMENTS: { value: PaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Crédito" },
  { value: "cartao_debito", label: "Débito" },
];

// ---- Ícones de linha (mesmo estilo da sidebar — nada de emoji) ----
const ICON = {
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="1" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5.5 12h.01M18.5 12h.01" />
    </>
  ),
  bolt: <path d="M13 2 3 14h8l-1 8 11-12h-8l1-8Z" />,
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="1" />
      <path d="M2 10h20" />
    </>
  ),
  bank: (
    <>
      <path d="M12 3 3 8h18l-9-5Z" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1" />
      <path d="M8 15h8v6H8z" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>
  ),
} as const;

function Ico({ name, className = "size-4" }: { name: keyof typeof ICON; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICON[name]}
    </svg>
  );
}

const PAY_ICON: Record<PaymentMethod, keyof typeof ICON> = {
  dinheiro: "cash",
  pix: "bolt",
  cartao_credito: "card",
  cartao_debito: "bank",
};

const CASH_INPUT =
  "h-9 w-28 rounded-none border border-zinc-300 bg-white px-2.5 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950";

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
  const totalQty = cart.reduce((s, l) => s + l.quantity, 0);

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
      <div className="mx-auto max-w-md">
        <div className="rounded-none border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Ico name="check" className="size-7" />
          </div>
          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Venda registrada
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">{result.number}</p>
          <p className="mt-4 font-serif text-4xl font-medium tracking-tight tabular-nums">
            {formatCurrency(result.totalCents)}
          </p>
          {result.changeCents != null && result.changeCents > 0 && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Troco{" "}
              <strong className="tabular-nums">{formatCurrency(result.changeCents)}</strong>
            </p>
          )}
          <div className="mt-7 flex flex-col gap-2">
            <a href={`/admin/pdv/recibo/${result.id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">
                <Ico name="printer" /> Imprimir recibo
              </Button>
            </a>
            <Button onClick={reset} className="w-full">
              Nova venda
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* --- Catálogo --- */}
      <div>
        <div className="relative">
          <Ico
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto por nome ou SKU..."
            autoFocus
            className="pl-9"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => {
            const soldOut = p.variants.length === 0 && p.stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => pick(p)}
                disabled={soldOut}
                className="group flex flex-col overflow-hidden rounded-none border border-zinc-200 bg-white text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-accent"
              >
                <span className="aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="line-clamp-2 text-xs font-medium leading-snug">{p.name}</span>
                  <span className="mt-auto text-sm font-semibold tabular-nums">
                    {formatCurrency(p.priceCents)}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
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
            <p className="col-span-full py-16 text-center text-sm text-zinc-400">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      </div>

      {/* --- Carrinho / caixa --- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Carrinho
            </h2>
            {totalQty > 0 && (
              <span className="flex size-6 items-center justify-center bg-accent text-[11px] font-semibold tabular-nums text-white">
                {totalQty}
              </span>
            )}
          </div>

          <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {cart.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-zinc-400">
                Clique nos produtos para adicionar.
              </p>
            ) : (
              cart.map((l) => (
                <div key={l.key} className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    {l.variantName && <p className="text-xs text-zinc-400">{l.variantName}</p>}
                    <p className="text-xs text-zinc-500 tabular-nums">
                      {formatCurrency(l.unitPriceCents)}
                    </p>
                  </div>
                  <div className="flex items-center border border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => changeQty(l.key, -1)}
                      className="flex size-7 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Diminuir"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm tabular-nums">{l.quantity}</span>
                    <button
                      onClick={() => changeQty(l.key, 1)}
                      className="flex size-7 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-16 text-right text-sm font-medium tabular-nums">
                    {formatCurrency(l.unitPriceCents * l.quantity)}
                  </div>
                  <button
                    onClick={() => removeLine(l.key)}
                    className="text-zinc-300 transition-colors hover:text-red-500 dark:text-zinc-600"
                    aria-label="Remover"
                  >
                    <Ico name="close" className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3.5 border-t border-zinc-200 p-4 dark:border-zinc-800">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">Desconto (R$)</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className={CASH_INPUT}
              />
            </label>

            <div className="space-y-1.5 border-y border-zinc-100 py-3 dark:border-zinc-800">
              <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotalCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex items-center justify-between text-sm text-emerald-600">
                  <span>Desconto</span>
                  <span className="tabular-nums">− {formatCurrency(discountCents)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Total
                </span>
                <span className="font-serif text-2xl font-medium tabular-nums">
                  {formatCurrency(totalCents)}
                </span>
              </div>
            </div>

            {/* Pagamento */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                Forma de pagamento
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENTS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPayment(m.value)}
                    className={`flex items-center justify-center gap-2 border px-2 py-2.5 text-sm font-medium transition-colors ${
                      payment === m.value
                        ? "border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                    }`}
                  >
                    <Ico name={PAY_ICON[m.value]} className="size-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payment === "dinheiro" && (
              <div className="space-y-2 border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-500">Valor recebido</span>
                  <input
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className={CASH_INPUT}
                  />
                </label>
                {received !== "" && (
                  <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-sm font-medium dark:border-zinc-700">
                    <span>Troco</span>
                    <span
                      className={`tabular-nums ${changeCents < 0 ? "text-red-500" : "text-emerald-600"}`}
                    >
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
                className="flex w-full items-center justify-between rounded-none border border-zinc-200 p-3 text-left text-sm transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800"
              >
                <span>
                  <span className="font-medium">{v.name}</span>
                  <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                    {out ? "Sem estoque" : `${v.stock} em estoque`}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
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
