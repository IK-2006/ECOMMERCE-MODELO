import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/Button";
import { TrackPurchase } from "@/components/tracking/TrackPurchase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Retorno do pagamento" };

/**
 * Página de retorno do Checkout Pro (back_urls).
 * O status REAL do pedido é atualizado pelo webhook — aqui apenas
 * mostramos uma mensagem amigável baseada nos parâmetros de retorno.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    collection_status?: string;
    external_reference?: string;
    payment_id?: string;
  }>;
}) {
  const params = await searchParams;
  const status = params.status ?? params.collection_status ?? "pending";
  const user = await getCurrentUser();

  let order:
    | {
        id: string;
        number: string;
        totalCents: number;
        items: { productId: string | null; name: string; quantity: number; unitPriceCents: number }[];
      }
    | null = null;
  if (params.external_reference && user) {
    order = await prisma.order.findFirst({
      where: { id: params.external_reference, userId: user.id },
      select: {
        id: true,
        number: true,
        totalCents: true,
        items: { select: { productId: true, name: true, quantity: true, unitPriceCents: true } },
      },
    });
  }
  const orderNumber = order?.number ?? null;

  const isApproved = status === "approved" || status === "success";
  const isPending = status === "pending" || status === "in_process";

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      {/* Tráfego pago: evento de COMPRA no navegador (dedup com o CAPI via event_id) */}
      {isApproved && order && (
        <TrackPurchase
          orderId={order.id}
          orderNumber={order.number}
          valueReais={order.totalCents / 100}
          items={order.items.map((i) => ({
            id: i.productId ?? i.name,
            name: i.name,
            priceReais: i.unitPriceCents / 100,
            quantity: i.quantity,
          }))}
        />
      )}
      <div className="text-6xl">{isApproved ? "🎉" : isPending ? "⏳" : "😕"}</div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">
        {isApproved
          ? "Pagamento aprovado!"
          : isPending
            ? "Pagamento em processamento"
            : "Pagamento não concluído"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
        {isApproved &&
          `Seu pedido ${orderNumber ?? ""} foi confirmado. Você receberá um e-mail com os detalhes e avisaremos a cada atualização.`}
        {isPending &&
          `Estamos aguardando a confirmação do pagamento${orderNumber ? ` do pedido ${orderNumber}` : ""}. Pagamentos via boleto podem levar até 2 dias úteis.`}
        {!isApproved && !isPending &&
          "O pagamento foi recusado ou cancelado. Nenhum valor foi cobrado — você pode tentar novamente."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/conta/pedidos">
          <Button>Meus pedidos</Button>
        </Link>
        <Link href="/produtos">
          <Button variant="outline">Continuar comprando</Button>
        </Link>
      </div>
    </div>
  );
}
