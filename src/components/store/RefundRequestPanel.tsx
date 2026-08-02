"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/providers/ToastProvider";
import { REFUND_REASON_LABELS } from "@/lib/utils";

export function RefundRequestPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("ARREPENDIMENTO");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar solicitação");
      toast("Solicitação de reembolso enviada!", "success");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao enviar", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h3 className="font-semibold">Precisa de ajuda com este pedido?</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Você pode solicitar o reembolso ou a devolução deste pedido. Nossa equipe vai
          analisar e responder por e-mail.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
          Solicitar reembolso / devolução
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <h3 className="font-semibold">Solicitar reembolso / devolução</h3>
      <Select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)}>
        {Object.entries(REFUND_REASON_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Textarea
        label="Conte o que aconteceu"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
        placeholder="Descreva o motivo do reembolso (mín. 10 caracteres)."
      />
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          Enviar solicitação
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
