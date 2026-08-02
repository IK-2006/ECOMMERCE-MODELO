import { prisma } from "@/lib/prisma";
import { handler } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/session";
import { ORDER_STATUS_LABELS } from "@/lib/utils";

/**
 * GET /api/admin/reports/sales?inicio=2026-01-01&fim=2026-01-31
 * Exporta CSV de vendas do período (separador ; — abre direto no Excel BR).
 */
export const GET = handler(async (req) => {
  await requireAdmin();

  const url = new URL(req.url);
  const inicio = url.searchParams.get("inicio");
  const fim = url.searchParams.get("fim");

  // datas malformadas viram Invalid Date -> caem no padrão (evita 500 no toISOString)
  const parseDate = (v: string | null, fallback: Date, endOfDay = false) => {
    if (!v) return fallback;
    const d = new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
    return isNaN(d.getTime()) ? fallback : d;
  };
  const start = parseDate(inicio, new Date(Date.now() - 30 * 864e5));
  const end = parseDate(fim, new Date(), true);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { user: { select: { name: true, email: true } }, items: true },
    orderBy: { createdAt: "asc" },
  });

  const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const header = [
    "Pedido", "Data", "Cliente", "E-mail", "Status", "Itens",
    "Subtotal (R$)", "Desconto (R$)", "Frete (R$)", "Total (R$)",
    "Cupom", "Pagamento", "Envio", "Rastreio",
  ].join(";");

  const rows = orders.map((o) =>
    [
      o.number,
      o.createdAt.toLocaleString("pt-BR"),
      esc(o.user.name),
      o.user.email,
      ORDER_STATUS_LABELS[o.status] ?? o.status,
      o.items.reduce((s, i) => s + i.quantity, 0),
      money(o.subtotalCents),
      money(o.discountCents),
      money(o.shippingCents),
      money(o.totalCents),
      o.couponCode ?? "",
      o.paymentMethod ?? "",
      o.shippingMethod,
      o.trackingCode ?? "",
    ].join(";")
  );

  // BOM UTF-8 para acentuação correta no Excel
  const csv = "﻿" + [header, ...rows].join("\r\n");
  const filename = `vendas_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
