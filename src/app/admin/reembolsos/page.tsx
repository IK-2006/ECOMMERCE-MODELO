import { prisma } from "@/lib/prisma";
import { RefundManager } from "@/components/admin/RefundManager";
import { OPEN_REFUND_STATUSES } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reembolsos" };

export default async function AdminRefundsPage() {
  const requests = await prisma.refundRequest.findMany({
    include: {
      order: { select: { number: true, totalCents: true, status: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const data = requests.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.order.number,
    orderStatus: r.order.status,
    totalCents: r.order.totalCents,
    customerName: r.user.name,
    customerEmail: r.user.email,
    reason: r.reason,
    description: r.description,
    status: r.status,
    adminNote: r.adminNote ?? "",
    createdAt: r.createdAt.toISOString(),
  }));

  const pending = data.filter((r) => OPEN_REFUND_STATUSES.includes(r.status)).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Reembolsos & devoluções</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Solicitações feitas pelos clientes. {pending > 0 ? `${pending} em aberto.` : "Nenhuma em aberto."}
        </p>
      </div>
      <RefundManager requests={data} />
    </div>
  );
}
