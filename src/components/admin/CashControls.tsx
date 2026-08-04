"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";

interface Summary {
  openingCents: number;
  vendasCents: number;
  suprimentosCents: number;
  sangriasCents: number;
  saldoCents: number;
}

const toCents = (v: string) => {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

type ActionKind = "sangria" | "suprimento" | "close" | null;

export function CashControls({
  session,
  summary,
  operatorName,
}: {
  session: { id: string } | null;
  summary: Summary | null;
  operatorName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("");
  const [action, setAction] = useState<ActionKind>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const call = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(okMsg);
      setAction(null);
      setAmount("");
      setNote("");
      setOpening("");
      router.refresh();
      return data;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro", "error");
    } finally {
      setBusy(false);
    }
  };

  // ----- Caixa fechado: tela de abertura -----
  if (!session) {
    return (
      <div className="mx-auto max-w-sm rounded-none border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">Caixa fechado</p>
        <h2 className="mt-2 font-serif text-2xl font-medium">Abrir caixa</h2>
        <p className="mt-1 text-sm text-zinc-500">Informe o fundo de troco para começar a vender.</p>
        <div className="mt-5 text-left">
          <Input
            label="Fundo de troco (R$)"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>
        <Button
          className="mt-5 w-full"
          loading={busy}
          onClick={() => call({ action: "open", openingCents: toCents(opening) }, "Caixa aberto!")}
        >
          Abrir caixa
        </Button>
      </div>
    );
  }

  // ----- Caixa aberto: barra de controle -----
  const s = summary!;
  const modalTitle =
    action === "sangria" ? "Sangria (retirada)" : action === "suprimento" ? "Suprimento (aporte)" : "Fechar caixa";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-none border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">Caixa aberto · {operatorName}</p>
          <p className="font-serif text-xl font-medium tabular-nums">
            {formatCurrency(s.saldoCents)} <span className="text-xs font-sans text-zinc-400">em dinheiro</span>
          </p>
        </div>
        <div className="hidden gap-4 text-[11px] text-zinc-500 sm:flex">
          <span>Abertura {formatCurrency(s.openingCents)}</span>
          <span>Vendas {formatCurrency(s.vendasCents)}</span>
          <span>Supri. {formatCurrency(s.suprimentosCents)}</span>
          <span>Sangria {formatCurrency(s.sangriasCents)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setAction("suprimento")}>Suprimento</Button>
        <Button size="sm" variant="outline" onClick={() => setAction("sangria")}>Sangria</Button>
        <Button size="sm" variant="secondary" onClick={() => setAction("close")}>Fechar caixa</Button>
      </div>

      <Modal open={action !== null} onClose={() => setAction(null)} title={modalTitle}>
        <div className="space-y-4">
          {action === "close" && (
            <p className="border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
              Dinheiro esperado na gaveta:{" "}
              <strong className="tabular-nums">{formatCurrency(s.saldoCents)}</strong>
            </p>
          )}
          <Input
            label={action === "close" ? "Valor contado na gaveta (R$)" : "Valor (R$)"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            autoFocus
          />
          <Input label="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAction(null)}>Cancelar</Button>
            <Button
              loading={busy}
              onClick={() => {
                const cents = toCents(amount);
                if (action === "close")
                  call({ action: "close", sessionId: session.id, closingCents: cents, note }, "Caixa fechado!");
                else
                  call(
                    { action, sessionId: session.id, amountCents: cents, note },
                    action === "sangria" ? "Sangria registrada." : "Suprimento registrado.",
                  );
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
