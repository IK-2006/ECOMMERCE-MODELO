"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import {
  formatCurrency,
  REFUND_REASON_LABELS,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_COLORS,
} from "@/lib/utils";

interface RefundView {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  totalCents: number;
  customerName: string;
  customerEmail: string;
  reason: string;
  description: string;
  status: string;
  adminNote: string;
  createdAt: string;
}

const RESOLVE_OPTIONS = ["EM_ANALISE", "APROVADO", "RECUSADO", "CONCLUIDO"];

export function RefundManager({ requests }: { requests: RefundView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<RefundView | null>(null);
  const [status, setStatus] = useState("EM_ANALISE");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const open = (r: RefundView) => {
    setEditing(r);
    setStatus(RESOLVE_OPTIONS.includes(r.status) ? r.status : "EM_ANALISE");
    setNote(r.adminNote);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/refunds/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      toast("Solicitação atualizada!", "success");
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="adm-table w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
            <th className="p-4 font-medium">Pedido</th>
            <th className="p-4 font-medium">Cliente</th>
            <th className="p-4 font-medium">Motivo</th>
            <th className="p-4 font-medium">Valor</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 text-right font-medium">Ação</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
              <td className="p-4">
                <Link
                  href={`/admin/pedidos/${r.orderId}`}
                  className="font-mono text-xs font-medium text-accent hover:underline"
                >
                  {r.orderNumber}
                </Link>
              </td>
              <td className="p-4">
                <p className="font-medium">{r.customerName}</p>
                <p className="text-xs text-zinc-400">{r.customerEmail}</p>
              </td>
              <td className="p-4 text-zinc-500">
                {REFUND_REASON_LABELS[r.reason] ?? r.reason}
              </td>
              <td className="p-4 font-medium">{formatCurrency(r.totalCents)}</td>
              <td className="p-4">
                <Badge className={REFUND_STATUS_COLORS[r.status]}>
                  {REFUND_STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </td>
              <td className="p-4 text-right">
                <Button size="sm" variant="outline" onClick={() => open(r)}>
                  Analisar
                </Button>
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={6} className="p-10 text-center text-zinc-400">
                Nenhuma solicitação de reembolso.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Reembolso · ${editing.orderNumber}` : ""}
      >
        {editing && (
          <div className="space-y-4">
            <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
              <p>
                <strong>{editing.customerName}</strong> — {editing.customerEmail}
              </p>
              <p className="mt-1 text-zinc-500">
                Motivo: {REFUND_REASON_LABELS[editing.reason] ?? editing.reason}
              </p>
              <p className="mt-1 whitespace-pre-line text-zinc-600 dark:text-zinc-300">
                {editing.description}
              </p>
            </div>

            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {RESOLVE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {REFUND_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>

            <Textarea
              label="Resposta ao cliente (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex.: Reembolso aprovado. O valor será estornado no cartão em até 2 faturas."
            />

            {status === "CONCLUIDO" && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Ao concluir, o pedido é marcado como <strong>Reembolsado</strong> e o estoque
                dos itens volta ao inventário. Faça o estorno do dinheiro no painel do Mercado Pago.
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={save} loading={saving}>
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
