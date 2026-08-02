"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";

export interface ShippingLabelPanelProps {
  orderId: string;
  status: string; // status comercial do pedido
  shippingCarrier: string;
  shippingLabelId: string | null;
  shippingLabelUrl: string | null;
  shippingCompany: string | null;
  shippingStatus: string | null;
  shippingError: string | null;
  trackingCode: string | null;
  postedAt: string | null; // ISO
  deliveredAt: string | null; // ISO
}

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  NO_CARRINHO: "No carrinho (aguardando pagamento da etiqueta)",
  PAGO: "Etiqueta paga",
  POSTADO: "Postado",
  ENTREGUE: "Entregue",
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ShippingLabelPanel(props: ShippingLabelPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [tracking, setTracking] = useState(false);

  const isMelhorEnvio = props.shippingCarrier === "MELHOR_ENVIO";
  const hasLabel = Boolean(props.shippingLabelId);
  const hasError = Boolean(props.shippingError);
  // etiqueta pronta para impressão/rastreio (passou do checkout)
  const isReady = ["POSTADO", "ENTREGUE"].includes(props.shippingStatus ?? "");
  const canGenerate =
    isMelhorEnvio && ["PAGO", "EM_SEPARACAO", "ENVIADO"].includes(props.status);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/orders/${props.orderId}/label`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(
        data.trackingCode
          ? `Etiqueta gerada! Rastreio ${data.trackingCode}. Cliente notificado.`
          : "Etiqueta gerada! Cliente notificado.",
      );
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Falha ao gerar etiqueta", "error");
    } finally {
      setGenerating(false);
    }
  };

  const refreshTracking = async () => {
    setTracking(true);
    try {
      const res = await fetch(`/api/admin/orders/${props.orderId}/tracking`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(
        data.delivered
          ? "Entrega confirmada! Pedido marcado como Entregue."
          : "Rastreio atualizado.",
      );
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Falha ao atualizar rastreio", "error");
    } finally {
      setTracking(false);
    }
  };

  const copyCode = async () => {
    if (!props.trackingCode) return;
    try {
      await navigator.clipboard.writeText(props.trackingCode);
      toast("Código de rastreio copiado!");
    } catch {
      toast("Não foi possível copiar", "error");
    }
  };

  return (
    <div className="rounded-none border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-semibold">Envio / Etiqueta</h2>

      {!isMelhorEnvio ? (
        <p className="mt-2 text-zinc-500">
          {props.shippingCarrier === "RETIRADA"
            ? "Retirada na loja — sem etiqueta de transporte."
            : "Este pedido não usa o Melhor Envio. Informe o rastreio manualmente, se houver."}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {/* estado atual */}
          {hasLabel && (
            <dl className="space-y-1 text-zinc-500">
              {props.shippingStatus && (
                <div className="flex justify-between">
                  <dt>Status do envio</dt>
                  <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                    {SHIPPING_STATUS_LABELS[props.shippingStatus] ?? props.shippingStatus}
                  </dd>
                </div>
              )}
              {props.shippingCompany && (
                <div className="flex justify-between">
                  <dt>Transportadora</dt>
                  <dd>{props.shippingCompany}</dd>
                </div>
              )}
              {props.trackingCode && (
                <div className="flex items-center justify-between gap-2">
                  <dt>Rastreio</dt>
                  <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                    {props.trackingCode}
                  </dd>
                </div>
              )}
              {props.postedAt && (
                <div className="flex justify-between">
                  <dt>Postado em</dt>
                  <dd>{fmt(props.postedAt)}</dd>
                </div>
              )}
              {props.deliveredAt && (
                <div className="flex justify-between">
                  <dt>Entregue em</dt>
                  <dd>{fmt(props.deliveredAt)}</dd>
                </div>
              )}
            </dl>
          )}

          {/* erro (mensagem preservada mesmo após progresso parcial) */}
          {hasError && props.shippingError && (
            <p className="border-l-2 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {props.shippingError}
            </p>
          )}

          {/* etiqueta pronta: imprimir / copiar / rastrear */}
          {isReady && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <a
                  href={`/api/admin/orders/${props.orderId}/label/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full">
                    Baixar etiqueta
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={copyCode}
                  disabled={!props.trackingCode}
                >
                  Copiar código
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                loading={tracking}
                onClick={refreshTracking}
              >
                Atualizar rastreamento
              </Button>
            </div>
          )}

          {/* ainda não pronta: gerar (ou reprocessar) */}
          {!isReady &&
            (canGenerate ? (
              <Button
                variant="secondary"
                className="w-full"
                loading={generating}
                onClick={generate}
              >
                {hasLabel || hasError ? "Tentar novamente" : "Gerar etiqueta"}
              </Button>
            ) : (
              <p className="text-xs text-amber-600">
                A etiqueta pode ser gerada após a confirmação do pagamento.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
