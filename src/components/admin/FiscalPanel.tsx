"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";

interface Invoice {
  id: string;
  type: string;
  status: string;
  number: number | null;
  accessKey: string | null;
  danfeUrl: string | null;
  xmlUrl: string | null;
  error: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  AUTORIZADA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  PROCESSANDO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  PENDENTE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  REJEITADA: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  ERRO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  CANCELADA: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};
const STATUS_LABELS: Record<string, string> = {
  AUTORIZADA: "Autorizada", PROCESSANDO: "Processando", PENDENTE: "Pendente",
  REJEITADA: "Rejeitada", ERRO: "Erro", CANCELADA: "Cancelada",
};
const TYPE_LABELS: Record<string, string> = { NFCE: "NFC-e", NFE: "NF-e" };

export function FiscalPanel({
  orderId,
  invoices,
  isConfigured,
  canEmit,
}: {
  orderId: string;
  invoices: Invoice[];
  isConfigured: boolean;
  canEmit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const emit = async (type: "NFCE" | "NFE") => {
    setBusy(type);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fiscal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.status === "AUTORIZADA") toast(`${TYPE_LABELS[type]} autorizada!`);
      else if (data.status === "ERRO" || data.status === "REJEITADA") toast(data.error || "Não foi possível emitir.", "error");
      else toast(`${TYPE_LABELS[type]} em processamento.`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao emitir", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-none border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-semibold">Fiscal</h2>

      {!isConfigured && (
        <p className="mt-2 rounded-none border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Emissor fiscal não configurado. As emissões ficam registradas, mas só são transmitidas
          à SEFAZ após configurar o provedor (token + certificado A1 + tributação).
        </p>
      )}

      {invoices.length > 0 && (
        <ul className="mt-3 space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800/60">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {TYPE_LABELS[inv.type] ?? inv.type}
                  {inv.number ? ` nº ${inv.number}` : ""}
                </span>
                <Badge className={STATUS_COLORS[inv.status]}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
              </div>
              {inv.error && <p className="mt-1 text-xs text-red-600">{inv.error}</p>}
              {(inv.danfeUrl || inv.xmlUrl) && (
                <div className="mt-1 flex gap-3 text-xs">
                  {inv.danfeUrl && <a href={inv.danfeUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">DANFE</a>}
                  {inv.xmlUrl && <a href={inv.xmlUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">XML</a>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEmit && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" loading={busy === "NFCE"} onClick={() => emit("NFCE")}>Emitir NFC-e</Button>
          <Button size="sm" variant="outline" loading={busy === "NFE"} onClick={() => emit("NFE")}>Emitir NF-e</Button>
        </div>
      )}
    </div>
  );
}
