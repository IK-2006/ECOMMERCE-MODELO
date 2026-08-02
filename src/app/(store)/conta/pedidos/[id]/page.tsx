import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getShippingProvider, hasCorreiosCredentials } from "@/services/shipping";
import { Badge } from "@/components/ui/Badge";
import { RefundRequestPanel } from "@/components/store/RefundRequestPanel";
import {
  formatCurrency,
  formatCep,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_COLORS,
  REFUND_REASON_LABELS,
  REFUNDABLE_ORDER_STATUSES,
  OPEN_REFUND_STATUSES,
} from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalhes do pedido" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      refundRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  const latestRefund = order.refundRequests[0] ?? null;
  const hasOpenRefund = order.refundRequests.some((r) =>
    OPEN_REFUND_STATUSES.includes(r.status)
  );
  const refundEligible =
    order.channel !== "LOJA" && REFUNDABLE_ORDER_STATUSES.includes(order.status);

  // rastreio via API dos Correios (quando houver credenciais e código)
  let trackingEvents: Array<{ date: string; status: string; location?: string }> = [];
  if (order.trackingCode && hasCorreiosCredentials()) {
    trackingEvents = await getShippingProvider()
      .track(order.trackingCode)
      .catch(() => []);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/conta/pedidos" className="text-sm text-zinc-400 hover:text-accent">
            ← Meus pedidos
          </Link>
          <h2 className="mt-1 text-xl font-bold">{order.number}</h2>
          <p className="text-xs text-zinc-400">Realizado em {formatDateTime(order.createdAt)}</p>
        </div>
        <Badge className={ORDER_STATUS_COLORS[order.status]}>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      {/* itens */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">🛍️</div>
                )}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-zinc-400">
                  {item.variantName ? `${item.variantName} · ` : ""}
                  {item.quantity}× {formatCurrency(item.unitPriceCents)}
                </p>
              </div>
              <span className="text-sm font-semibold">
                {formatCurrency(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-zinc-100 p-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</span>
              <span>-{formatCurrency(order.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-zinc-500">
            <span>Frete ({order.shippingMethod})</span>
            <span>{order.shippingCents === 0 ? "Grátis" : formatCurrency(order.shippingCents)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.totalCents)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* entrega */}
        <div className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
          <h3 className="font-semibold">
            {order.shippingCarrier === "RETIRADA" ? "Retirada na loja" : "Entrega"}
          </h3>
          {order.shippingCarrier === "RETIRADA" ? (
            <div className="mt-2 text-zinc-500">
              <p>
                Este pedido é para <strong className="text-zinc-700 dark:text-zinc-300">retirada na loja</strong>.
                Você será avisado quando estiver pronto.
              </p>
              {process.env.STORE_PICKUP_ADDRESS && (
                <p className="mt-2 whitespace-pre-line">
                  Endereço para retirada:
                  <br />
                  {process.env.STORE_PICKUP_ADDRESS}
                </p>
              )}
              <p className="mt-2">Retirado por: {order.shipRecipient}</p>
            </div>
          ) : (
            <p className="mt-2 text-zinc-500">
              {order.shipRecipient}
              <br />
              {order.shipStreet}, {order.shipNumber}
              {order.shipComplement ? ` – ${order.shipComplement}` : ""}
              <br />
              {order.shipDistrict} · {order.shipCity}/{order.shipState}
              <br />
              CEP {formatCep(order.shipCep)}
            </p>
          )}
          {order.shippingCarrier !== "RETIRADA" && order.trackingCode && (
            <p className="mt-3">
              Código de rastreio:{" "}
              <a
                href={`https://rastreamento.correios.com.br/app/index.php?objeto=${order.trackingCode}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {order.trackingCode}
              </a>
            </p>
          )}
        </div>

        {/* histórico de status */}
        <div className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
          <h3 className="font-semibold">Acompanhamento</h3>
          <ol className="mt-3 space-y-3">
            {order.statusHistory.map((h, i) => (
              <li key={h.id} className="flex gap-3">
                <span
                  className={`mt-1 size-2.5 shrink-0 rounded-full ${i === 0 ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-700"}`}
                />
                <div>
                  <p className={i === 0 ? "font-medium" : "text-zinc-500"}>
                    {ORDER_STATUS_LABELS[h.status] ?? h.status}
                  </p>
                  {h.note && <p className="text-xs text-zinc-400">{h.note}</p>}
                  <p className="text-xs text-zinc-400">{formatDateTime(h.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* eventos dos correios */}
      {trackingEvents.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
          <h3 className="font-semibold">Rastreamento Correios</h3>
          <ol className="mt-3 space-y-2">
            {trackingEvents.map((e, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>{e.status}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {e.location ? `${e.location} · ` : ""}
                  {e.date ? formatDateTime(e.date) : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {order.status === "AGUARDANDO_PAGAMENTO" && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Aguardando confirmação do pagamento. Pagamentos via boleto podem levar
          até 2 dias úteis para compensar.
        </p>
      )}

      {/* Reembolso / devolução */}
      {latestRefund ? (
        <div className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Reembolso / devolução</h3>
            <Badge className={REFUND_STATUS_COLORS[latestRefund.status]}>
              {REFUND_STATUS_LABELS[latestRefund.status] ?? latestRefund.status}
            </Badge>
          </div>
          <p className="mt-3 text-zinc-500">
            Motivo: {REFUND_REASON_LABELS[latestRefund.reason] ?? latestRefund.reason}
          </p>
          <p className="mt-1 whitespace-pre-line text-zinc-500">{latestRefund.description}</p>
          {latestRefund.adminNote && (
            <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
              <strong>Resposta da loja:</strong> {latestRefund.adminNote}
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Solicitado em {formatDateTime(latestRefund.createdAt)}
          </p>
          {latestRefund.status === "RECUSADO" && refundEligible && !hasOpenRefund && (
            <div className="mt-4">
              <RefundRequestPanel orderId={order.id} />
            </div>
          )}
        </div>
      ) : (
        refundEligible && <RefundRequestPanel orderId={order.id} />
      )}
    </div>
  );
}
