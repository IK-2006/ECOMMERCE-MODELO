"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/providers/ToastProvider";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/utils";

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentTracking,
}: {
  orderId: string;
  currentStatus: string;
  currentTracking: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [trackingCode, setTrackingCode] = useState(currentTracking);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, trackingCode, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Pedido atualizado! Cliente notificado por e-mail.");
      setNote("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao atualizar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-none border border-accent/40 bg-white p-5 dark:bg-zinc-900"
    >
      <h2 className="font-semibold">Atualizar pedido</h2>
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Input
        label="Código de rastreio"
        value={trackingCode}
        onChange={(e) => setTrackingCode(e.target.value)}
        placeholder="AA123456789BR"
      />
      <Input
        label="Observação (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Visível no histórico do pedido"
      />
      <Button type="submit" className="w-full" loading={saving}>
        Salvar e notificar cliente
      </Button>
      {status === "CANCELADO" && currentStatus !== "CANCELADO" && (
        <p className="text-xs text-amber-600">
          ⚠️ Ao cancelar, o estoque dos itens é devolvido automaticamente.
        </p>
      )}
    </form>
  );
}
