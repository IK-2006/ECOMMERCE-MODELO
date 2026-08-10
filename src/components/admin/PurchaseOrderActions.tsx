"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";
import { filterMoneyInput } from "@/lib/masks";

interface POItem {
  id: string;
  name: string;
  pending: number;
  unitCostCents: number;
}

const toCents = (v: string) => {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const centsToStr = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function PurchaseOrderActions({
  id,
  status,
  items,
}: {
  id: string;
  status: string;
  items: POItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  // linhas de recebimento: qty e custo (R$) por item pendente
  const [rows, setRows] = useState<Record<string, { qty: number; cost: string }>>(() =>
    Object.fromEntries(items.filter((i) => i.pending > 0).map((i) => [i.id, { qty: i.pending, cost: centsToStr(i.unitCostCents) }]))
  );

  const canReceive = status === "ENVIADA" || status === "RECEBIDA_PARCIAL";
  const canSend = status === "RASCUNHO";
  const canCancel = status !== "RECEBIDA" && status !== "CANCELADA";
  const pendingItems = items.filter((i) => i.pending > 0);

  const act = async (action: "send" | "cancel") => {
    if (action === "cancel" && !confirm("Cancelar esta ordem de compra?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/purchases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(action === "send" ? "Ordem marcada como enviada." : "Ordem cancelada", "info");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro", "error");
    } finally {
      setBusy(false);
    }
  };

  const submitReceive = async () => {
    const lines = pendingItems
      .map((i) => ({ itemId: i.id, qty: rows[i.id]?.qty ?? 0, unitCostCents: toCents(rows[i.id]?.cost ?? "") }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) {
      toast("Informe as quantidades recebidas", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/purchases/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Recebimento registrado! Estoque e conta a pagar atualizados.");
      setReceiveOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao receber", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!canSend && !canReceive && !canCancel) {
    return <p className="text-sm text-zinc-400">Esta ordem está {status === "RECEBIDA" ? "totalmente recebida" : "cancelada"}.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canSend && <Button onClick={() => act("send")} loading={busy}>Marcar como enviada</Button>}
      {canReceive && <Button onClick={() => setReceiveOpen(true)} disabled={busy}>Receber mercadoria</Button>}
      {canCancel && <Button variant="ghost" onClick={() => act("cancel")} disabled={busy}>Cancelar OC</Button>}

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receber mercadoria">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            Confirme o que chegou (parcial ou total). O custo pode ser ajustado pela nota do fornecedor.
          </p>
          <div className="divide-y divide-zinc-100 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-zinc-400">
              <span className="min-w-0 flex-1">Produto</span>
              <span className="w-16 text-right">Receber</span>
              <span className="w-24 text-right">Custo un.</span>
            </div>
            {pendingItems.map((i) => (
              <div key={i.id} className="flex items-center gap-2 p-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {i.name} <span className="text-zinc-400">(pend. {i.pending})</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={i.pending}
                  value={rows[i.id]?.qty ?? 0}
                  onChange={(e) =>
                    setRows((prev) => ({ ...prev, [i.id]: { ...prev[i.id], qty: Math.min(i.pending, Math.max(0, Number(e.target.value))) } }))
                  }
                  className="h-9 w-16 rounded-none border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950"
                  aria-label="Quantidade recebida"
                />
                <input
                  value={rows[i.id]?.cost ?? ""}
                  onChange={(e) => setRows((prev) => ({ ...prev, [i.id]: { ...prev[i.id], cost: filterMoneyInput(e.target.value) } }))}
                  inputMode="decimal"
                  className="h-9 w-24 rounded-none border border-zinc-300 bg-white px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-zinc-700 dark:bg-zinc-950"
                  aria-label="Custo unitário"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReceiveOpen(false)}>Cancelar</Button>
            <Button loading={busy} onClick={submitReceive}>Confirmar recebimento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
