import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isMercadoPagoConfigured } from "@/services/payments/mercadopago";
import { formatCurrency } from "@/lib/utils";
import { SimulatedPaymentActions } from "./SimulatedPaymentActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamento (simulado)" };

/**
 * GATEWAY SIMULADO — só existe quando o Mercado Pago NÃO está
 * configurado no .env. Permite testar o fluxo completo de compra
 * (aprovar / recusar) sem credenciais. Com MERCADOPAGO_ACCESS_TOKEN
 * preenchido, o checkout redireciona para o Checkout Pro real e
 * esta página retorna 404.
 */
export default async function SimulatedCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  if (isMercadoPagoConfigured()) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const { pedido } = await searchParams;
  if (!pedido) notFound();

  const order = await prisma.order.findFirst({
    where: { id: pedido, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="border border-dashed border-amber-400 bg-amber-50 p-4 text-center text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
        MODO DE TESTE — o Mercado Pago não está configurado no .env.
        <br />
        Este gateway simulado permite testar o fluxo de compra completo.
      </div>

      <div className="mt-6 border border-zinc-200 p-7 dark:border-zinc-800">
        <h1 className="text-xs font-medium uppercase tracking-[0.25em]">
          Pagamento do pedido {order.number}
        </h1>
        <ul className="mt-5 space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-300">
                {item.quantity}× {item.name}
                {item.variantName ? ` (${item.variantName})` : ""}
              </span>
              <span>{formatCurrency(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between text-zinc-500">
            <span>Frete ({order.shippingMethod})</span>
            <span>{formatCurrency(order.shippingCents)}</span>
          </li>
          {order.discountCents > 0 && (
            <li className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>Desconto {order.couponCode ? `(${order.couponCode})` : ""}</span>
              <span>−{formatCurrency(order.discountCents)}</span>
            </li>
          )}
        </ul>
        <hr className="my-5 border-zinc-200 dark:border-zinc-800" />
        <div className="flex justify-between text-lg font-medium">
          <span>Total</span>
          <span>{formatCurrency(order.totalCents)}</span>
        </div>

        <SimulatedPaymentActions orderId={order.id} />
      </div>
    </div>
  );
}
