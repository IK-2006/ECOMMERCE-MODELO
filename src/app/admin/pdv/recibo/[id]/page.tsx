import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { formatCurrency } from "@/lib/utils";
import { storeConfig } from "@/lib/store-config";
import { STORE_PAYMENT_LABELS } from "@/services/store-sale";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recibo de venda" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("pos.operate");
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();

  const paidLabel = order.paymentMethod
    ? STORE_PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod
    : "—";
  const change =
    order.amountReceivedCents != null ? order.amountReceivedCents - order.totalCents : null;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/pdv" className="text-sm text-zinc-500 hover:text-accent">
          ← Voltar ao caixa
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-none border border-zinc-200 bg-white p-6 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 print:border-0 print:text-black">
        {/* Cabeçalho */}
        <div className="text-center">
          <h1 className="text-lg font-bold">{storeConfig.legalName || storeConfig.name}</h1>
          {storeConfig.cnpj && <p className="text-xs text-zinc-500">CNPJ {storeConfig.cnpj}</p>}
          {storeConfig.pickupAddress && (
            <p className="text-xs text-zinc-500">{storeConfig.pickupAddress}</p>
          )}
        </div>

        <div className="my-4 border-t border-dashed border-zinc-300 dark:border-zinc-700" />

        <div className="flex justify-between text-xs text-zinc-500">
          <span>Pedido {order.number}</span>
          <span>
            {new Date(order.createdAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>

        <div className="my-4 border-t border-dashed border-zinc-300 dark:border-zinc-700" />

        {/* Itens */}
        <div className="space-y-2">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block">
                  {i.quantity}× {i.name}
                  {i.variantName ? ` (${i.variantName})` : ""}
                </span>
                <span className="text-xs text-zinc-400">{formatCurrency(i.unitPriceCents)} un.</span>
              </span>
              <span className="whitespace-nowrap font-medium">
                {formatCurrency(i.unitPriceCents * i.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="my-4 border-t border-dashed border-zinc-300 dark:border-zinc-700" />

        {/* Totais */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-zinc-500">
              <span>Desconto</span>
              <span>− {formatCurrency(order.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.totalCents)}</span>
          </div>
          <div className="flex justify-between pt-1 text-zinc-500">
            <span>Pagamento</span>
            <span>{paidLabel}</span>
          </div>
          {order.amountReceivedCents != null && (
            <>
              <div className="flex justify-between text-zinc-500">
                <span>Recebido</span>
                <span>{formatCurrency(order.amountReceivedCents)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Troco</span>
                <span>{formatCurrency(Math.max(0, change ?? 0))}</span>
              </div>
            </>
          )}
        </div>

        <div className="my-4 border-t border-dashed border-zinc-300 dark:border-zinc-700" />

        <p className="text-center text-[11px] leading-relaxed text-zinc-400">
          Documento sem valor fiscal — comprovante interno de venda.
          <br />
          Obrigada pela preferência! {storeConfig.instagramHandle}
        </p>
      </div>
    </div>
  );
}
