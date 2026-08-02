import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus pedidos" };

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="◇"
        title="Você ainda não fez nenhum pedido"
        description="Quando você comprar, seus pedidos aparecerão aqui."
        action={
          <Link href="/produtos">
            <Button>Ver produtos</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className="border border-zinc-200 p-5 transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
        >
          {/* corpo do pedido → leva ao detalhe */}
          <Link href={`/conta/pedidos/${order.id}`} className="block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{order.number}</p>
                <p className="mt-0.5 text-[11px] tracking-wide text-zinc-400">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <Badge className={ORDER_STATUS_COLORS[order.status]}>
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-zinc-500">
                {order.items.length} ite{order.items.length === 1 ? "m" : "ns"}
              </p>
              <p className="font-medium">{formatCurrency(order.totalCents)}</p>
            </div>
          </Link>

          {/* código de rastreio (link direto para a transportadora) */}
          {order.trackingCode && order.shippingCarrier !== "RETIRADA" && (
            <a
              href={`https://rastreamento.correios.com.br/app/index.php?objeto=${order.trackingCode}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-sm text-accent hover:underline dark:border-zinc-800"
            >
              <span className="truncate">
                Rastrear{order.shippingCompany ? ` · ${order.shippingCompany}` : ""}:{" "}
                <span className="font-medium">{order.trackingCode}</span>
              </span>
              <span aria-hidden className="shrink-0">
                →
              </span>
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
