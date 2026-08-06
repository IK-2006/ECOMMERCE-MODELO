import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { Badge } from "@/components/ui/Badge";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { ShippingLabelPanel } from "@/components/admin/ShippingLabelPanel";
import { FiscalPanel } from "@/components/admin/FiscalPanel";
import { roleHasPermission } from "@/lib/permissions";
import { isFiscalConfigured } from "@/lib/fiscal-config";
import {
  formatCurrency,
  formatCep,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePagePermission("orders.read");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      fiscalInvoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  const canEmitFiscal = roleHasPermission(actor.role, "fiscal.manage");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/pedidos" className="text-sm text-zinc-400 hover:text-accent">
        ← Pedidos
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">{order.number}</h1>
          <p className="text-sm text-zinc-400">Criado em {formatDateTime(order.createdAt)}</p>
        </div>
        <Badge className={ORDER_STATUS_COLORS[order.status]}>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* itens */}
          <div className="rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="p-5 pb-0 font-semibold">Itens</h2>
            <ul className="divide-y divide-zinc-100 p-5 dark:divide-zinc-800">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="size-full object-cover" />
                    ) : null}
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
            <div className="space-y-1.5 border-t border-zinc-100 p-5 text-sm dark:border-zinc-800">
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
                <span>
                  Frete — {order.shippingMethod} ({order.shippingCarrier})
                </span>
                <span>{formatCurrency(order.shippingCents)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(order.totalCents)}</span>
              </div>
            </div>
          </div>

          {/* histórico */}
          <div className="rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Histórico</h2>
            <ol className="mt-3 space-y-3 text-sm">
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

        <div className="space-y-6">
          {/* atualizar status */}
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            currentTracking={order.trackingCode ?? ""}
          />

          {/* envio / etiqueta (Melhor Envio) */}
          <ShippingLabelPanel
            orderId={order.id}
            status={order.status}
            shippingCarrier={order.shippingCarrier}
            shippingLabelId={order.shippingLabelId}
            shippingLabelUrl={order.shippingLabelUrl}
            shippingCompany={order.shippingCompany}
            shippingStatus={order.shippingStatus}
            shippingError={order.shippingError}
            trackingCode={order.trackingCode}
            postedAt={order.shippingPostedAt ? order.shippingPostedAt.toISOString() : null}
            deliveredAt={order.shippingDeliveredAt ? order.shippingDeliveredAt.toISOString() : null}
          />

          {/* fiscal (NFC-e / NF-e) */}
          <FiscalPanel
            orderId={order.id}
            invoices={order.fiscalInvoices.map((inv) => ({
              id: inv.id,
              type: inv.type,
              status: inv.status,
              number: inv.number,
              accessKey: inv.accessKey,
              danfeUrl: inv.danfeUrl,
              xmlUrl: inv.xmlUrl,
              error: inv.error,
            }))}
            isConfigured={isFiscalConfigured()}
            canEmit={canEmitFiscal}
          />

          {/* cliente */}
          <div className="rounded-none border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Cliente</h2>
            <p className="mt-2 font-medium">{order.user.name}</p>
            <p className="text-zinc-500">{order.user.email}</p>
            {order.user.phone && <p className="text-zinc-500">{order.user.phone}</p>}
            <Link
              href={`/admin/clientes/${order.user.id}`}
              className="mt-2 inline-block text-accent hover:underline"
            >
              Ver perfil completo →
            </Link>
          </div>

          {/* entrega */}
          <div className="rounded-none border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Entrega</h2>
            <p className="mt-2 text-zinc-500">
              {order.shipRecipient}
              <br />
              {order.shipStreet}, {order.shipNumber}
              {order.shipComplement ? ` – ${order.shipComplement}` : ""}
              <br />
              {order.shipDistrict} · {order.shipCity}/{order.shipState}
              <br />
              CEP {formatCep(order.shipCep)}
              {order.shipPhone && (
                <>
                  <br />
                  Tel: {order.shipPhone}
                </>
              )}
            </p>
            {order.trackingCode && (
              <p className="mt-2">
                Rastreio: <span className="font-medium">{order.trackingCode}</span>
              </p>
            )}
          </div>

          {/* pagamento */}
          <div className="rounded-none border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Pagamento</h2>
            <dl className="mt-2 space-y-1 text-zinc-500">
              <div className="flex justify-between">
                <dt>Método</dt>
                <dd>{order.paymentMethod ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ID Mercado Pago</dt>
                <dd className="max-w-40 truncate">{order.mpPaymentId ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Pago em</dt>
                <dd>{order.paidAt ? formatDateTime(order.paidAt) : "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
