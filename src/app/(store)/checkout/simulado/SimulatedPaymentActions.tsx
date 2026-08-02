"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";

export function SimulatedPaymentActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const simulate = async (action: "approve" | "reject") => {
    setBusy(action);
    try {
      const res = await fetch("/api/checkout/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(
        `/checkout/retorno?status=${action === "approve" ? "approved" : "rejected"}&external_reference=${orderId}`
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro na simulação", "error");
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 space-y-2">
      <Button
        size="lg"
        className="w-full"
        onClick={() => simulate("approve")}
        loading={busy === "approve"}
        disabled={busy !== null}
      >
        ✓ Simular pagamento aprovado
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="w-full"
        onClick={() => simulate("reject")}
        loading={busy === "reject"}
        disabled={busy !== null}
      >
        ✗ Simular pagamento recusado
      </Button>
    </div>
  );
}
