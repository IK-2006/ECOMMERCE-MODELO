"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";

interface PickerItem {
  productId: string;
  variantId: string | null;
  label: string;
  sku: string | null;
  stock: number;
}
interface Line extends PickerItem {
  key: string;
  counted: number;
}

export function InventoryPanel({ items }: { items: PickerItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.label.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  const keyOf = (i: PickerItem) => i.variantId ?? i.productId;

  const addLine = (i: PickerItem) => {
    const key = keyOf(i);
    setQuery("");
    setLines((prev) => (prev.some((l) => l.key === key) ? prev : [...prev, { ...i, key, counted: i.stock }]));
  };
  const setCounted = (key: string, counted: number) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, counted: Math.max(0, counted) } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const submit = async () => {
    const changed = lines.filter((l) => l.counted !== l.stock);
    if (changed.length === 0) {
      toast("Nenhuma diferença para ajustar.", "info");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/stock/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counts: changed.map((l) => ({ productId: l.productId, variantId: l.variantId, countedStock: l.counted })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Inventário aplicado! ${data.adjusted} item(ns) ajustado(s).`);
      setLines([]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao aplicar inventário", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Inventário / balanço</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Inventário / balanço">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            Busque os itens, informe a quantidade <strong>contada</strong> e salve. A diferença
            vira um ajuste de estoque (movimento de correção).
          </p>

          <div className="relative">
            <Input
              label="Adicionar item"
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
                    <span className="text-xs text-zinc-400">estoque {m.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
              Busque e clique nos itens para conferir a contagem.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-400">
                <span className="min-w-0 flex-1">Item</span>
                <span className="w-16 text-right">Sistema</span>
                <span className="w-20 text-right">Contado</span>
                <span className="w-16 text-right">Dif.</span>
                <span className="w-6" />
              </div>
              {lines.map((l) => {
                const diff = l.counted - l.stock;
                return (
                  <div key={l.key} className="flex items-center gap-2 p-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span className="w-16 text-right tabular-nums text-zinc-500">{l.stock}</span>
                    <input
                      type="number"
                      min={0}
                      value={l.counted}
                      onChange={(e) => setCounted(l.key, Number(e.target.value))}
                      className="h-9 w-20 rounded-none border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950"
                      aria-label="Contado"
                    />
                    <span className={`w-16 text-right tabular-nums font-medium ${diff === 0 ? "text-zinc-400" : diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="w-6 text-zinc-300 hover:text-red-500 dark:text-zinc-600"
                      aria-label="Remover"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={saving} disabled={lines.length === 0} onClick={submit}>Aplicar inventário</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
