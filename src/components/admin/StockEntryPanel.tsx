"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";

interface PickerItem {
  productId: string;
  variantId: string | null;
  label: string;
  sku: string | null;
}
interface Line extends PickerItem {
  key: string;
  quantity: number;
  cost: string; // R$ digitado
}

const toCents = (v: string) => {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export function StockEntryPanel({
  items,
  suppliers,
}: {
  items: PickerItem[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => i.label.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, query]);

  const keyOf = (i: PickerItem) => i.variantId ?? i.productId;

  const addLine = (i: PickerItem) => {
    const key = keyOf(i);
    setQuery("");
    setLines((prev) =>
      prev.some((l) => l.key === key)
        ? prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev, { ...i, key, quantity: 1, cost: "" }],
    );
  };
  const setQty = (key: string, q: number) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, q) } : l)));
  const setCost = (key: string, cost: string) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, cost } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const reset = () => {
    setSupplierId("");
    setNote("");
    setQuery("");
    setLines([]);
  };

  const submit = async () => {
    if (lines.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/stock/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          note: note || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            costCents: l.cost ? toCents(l.cost) : null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Entrada registrada! ${lines.length} item(ns) somado(s) ao estoque.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao registrar entrada", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Entrada de mercadoria</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Entrada de mercadoria">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Fornecedor (opcional)" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Sem fornecedor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Input label="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: NF 1234" />
          </div>

          {/* busca de produto */}
          <div className="relative">
            <Input
              label="Adicionar produto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
            />
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-none border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {matches.map((m) => (
                  <button
                    key={keyOf(m)}
                    type="button"
                    onClick={() => addLine(m)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent-soft dark:hover:bg-accent-soft-dark"
                  >
                    <span>{m.label}</span>
                    {m.sku && <span className="text-xs text-zinc-400">{m.sku}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* linhas */}
          {lines.length === 0 ? (
            <p className="border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
              Busque e clique nos produtos para adicionar à entrada.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2 p-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => setQty(l.key, Number(e.target.value))}
                    className="h-9 w-16 rounded-none border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950"
                    aria-label="Quantidade"
                  />
                  <input
                    value={l.cost}
                    onChange={(e) => setCost(l.key, e.target.value)}
                    placeholder="custo R$"
                    inputMode="decimal"
                    className="h-9 w-24 rounded-none border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950"
                    aria-label="Custo unitário"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="px-1 text-zinc-300 hover:text-red-500 dark:text-zinc-600"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} disabled={lines.length === 0} onClick={submit}>
              Registrar entrada
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
