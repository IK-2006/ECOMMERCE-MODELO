import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { storeSaleSchema } from "@/lib/validations";
import { createStoreSale } from "@/services/store-sale";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** POST /api/admin/pdv — registra uma venda no balcão (já paga) */
export const POST = handler(async (req) => {
  const admin = await requirePermission("pos.operate");
  const body = storeSaleSchema.parse(await req.json());

  const order = await createStoreSale({
    adminId: admin.id,
    items: body.items,
    paymentMethod: body.paymentMethod,
    discountCents: body.discountCents,
    amountReceivedCents: body.amountReceivedCents ?? null,
    cashSessionId: body.cashSessionId ?? null,
    fiscalCpf: body.fiscalCpf || null,
  });

  await audit({
    userId: admin.id,
    action: "store.sale",
    entity: "Order",
    entityId: order.id,
    detail: { number: order.number, totalCents: order.totalCents, paymentMethod: body.paymentMethod },
    ip: getClientIp(req),
  });

  const changeCents =
    body.paymentMethod === "dinheiro" && body.amountReceivedCents != null
      ? body.amountReceivedCents - order.totalCents
      : null;

  return NextResponse.json(
    { id: order.id, number: order.number, totalCents: order.totalCents, changeCents },
    { status: 201 }
  );
});
