"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { Button } from "@/components/ui/Button";
import { QuantityInput } from "./QuantityInput";
import { trackAddToCart } from "@/lib/track-client";
import { formatCurrency, cn } from "@/lib/utils";

interface VariantView {
  id: string;
  name: string;
  size: string | null;
  color: string | null;
  priceCents: number | null;
  stock: number;
}

export function PurchasePanel({
  productId,
  productName,
  basePriceCents,
  baseStock,
  variants,
}: {
  productId: string;
  productName: string;
  basePriceCents: number;
  baseStock: number;
  variants: VariantView[];
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);

  const hasVariants = variants.length > 0;
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId]
  );

  const priceCents = selectedVariant?.priceCents ?? basePriceCents;
  const stock = hasVariants ? (selectedVariant?.stock ?? 0) : baseStock;
  const needsVariant = hasVariants && !selectedVariant;
  const soldOut = hasVariants
    ? variants.every((v) => v.stock <= 0)
    : baseStock <= 0;

  // agrupa variações por tamanho/cor quando disponíveis
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];

  // rótulos conforme o tipo de variação (tamanho, acabamento, pedra...)
  const sizeLabel = sizes.every((s) => /^(PP|P|M|G|GG|XG|\d+)$/i.test(s))
    ? "Tamanho"
    : sizes.some((s) => /banhad|borda|natural|banho/i.test(s))
      ? "Acabamento"
      : "Opção";
  const colorLabel = colors.some((c) =>
    /quartzo|cristal|ametista|ônix|onix|jade|opalina|sodalita|citrino|olho de tigre|amazonita|pirita|howlita|fumê|cornalina|ágata/i.test(c)
  )
    ? "Pedra"
    : "Cor";
  const useGrid = sizes.length > 0 || colors.length > 0;
  const [selSize, setSelSize] = useState<string | null>(null);
  const [selColor, setSelColor] = useState<string | null>(null);

  const pickVariant = (size: string | null, color: string | null) => {
    setSelSize(size);
    setSelColor(color);
    const match = variants.find(
      (v) =>
        (sizes.length === 0 || v.size === size) &&
        (colors.length === 0 || v.color === color)
    );
    setVariantId(match?.id ?? null);
  };

  const fireAddToCart = () =>
    trackAddToCart({ id: productId, name: productName, priceReais: priceCents / 100, quantity });

  const handleAdd = async () => {
    setAdding(true);
    const ok = await addItem(productId, hasVariants ? variantId : null, quantity);
    if (ok) fireAddToCart();
    setAdding(false);
  };

  const handleBuyNow = async () => {
    setBuying(true);
    const ok = await addItem(productId, hasVariants ? variantId : null, quantity);
    if (ok) {
      fireAddToCart();
      router.push("/carrinho");
    } else setBuying(false);
  };

  const optionClass = (selected: boolean, available: boolean) =>
    cn(
      "h-10 min-w-12 border px-4 text-xs tracking-wide transition-colors",
      selected
        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        : "border-zinc-300 text-zinc-700 hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100",
      !available && "cursor-not-allowed opacity-30 line-through"
    );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-medium tracking-tight">{formatCurrency(priceCents)}</span>
        <span className="text-xs tracking-wide text-zinc-400">
          em até 12× no cartão ou à vista no Pix
        </span>
      </div>

      {useGrid ? (
        <>
          {sizes.length > 0 && (
            <div>
              <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                {sizeLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const available = variants.some(
                    (v) => v.size === size && (colors.length === 0 || !selColor || v.color === selColor) && v.stock > 0
                  );
                  return (
                    <button
                      key={size}
                      onClick={() => pickVariant(size, selColor)}
                      disabled={!available}
                      className={optionClass(selSize === size, available)}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {colors.length > 0 && (
            <div>
              <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                {colorLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => {
                  const available = variants.some(
                    (v) => v.color === color && (sizes.length === 0 || !selSize || v.size === selSize) && v.stock > 0
                  );
                  return (
                    <button
                      key={color}
                      onClick={() => pickVariant(selSize, color)}
                      disabled={!available}
                      className={optionClass(selColor === color, available)}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        hasVariants && (
          <div>
            <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Opção
            </p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  disabled={v.stock <= 0}
                  className={optionClass(variantId === v.id, v.stock > 0)}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* estoque */}
      {soldOut ? (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
          Produto esgotado
        </p>
      ) : needsVariant ? (
        <p className="text-xs tracking-wide text-zinc-400">Selecione uma opção para continuar</p>
      ) : stock <= 5 ? (
        <p className="text-xs font-medium tracking-wide text-accent">
          Restam apenas {stock} unidade{stock > 1 ? "s" : ""}
        </p>
      ) : (
        <p className="text-xs tracking-wide text-zinc-500">Em estoque</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityInput
          value={quantity}
          onChange={setQuantity}
          max={Math.max(1, Math.min(stock, 99))}
          disabled={soldOut || needsVariant}
        />
        <Button
          size="lg"
          onClick={handleBuyNow}
          loading={buying}
          disabled={soldOut || needsVariant}
          className="min-w-44 flex-1"
        >
          Comprar agora
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={handleAdd}
          loading={adding}
          disabled={soldOut || needsVariant}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
