import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { getPrintUrl } from "@/services/shipping/melhorenvio-labels";

/**
 * GET /api/admin/orders/[id]/label/pdf
 * Redireciona para o PDF da etiqueta. Busca uma URL de impressão FRESCA
 * no Melhor Envio (a reimpressão não cobra saldo) e cai para a última
 * URL conhecida se a chamada falhar. Somente admin.
 */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("orders.write");
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { shippingLabelId: true, shippingLabelUrl: true },
  });
  if (!order) throw new ApiError(404, "Pedido não encontrado");
  if (!order.shippingLabelId) throw new ApiError(400, "Pedido sem etiqueta gerada.");

  let url = order.shippingLabelUrl;
  try {
    const fresh = await getPrintUrl([order.shippingLabelId]);
    url = fresh;
    // atualiza a URL conhecida (best-effort)
    await prisma.order.update({ where: { id }, data: { shippingLabelUrl: fresh } }).catch(() => {});
  } catch {
    // usa a URL armazenada, se houver
  }
  if (!url) throw new ApiError(502, "Não foi possível obter o PDF da etiqueta agora. Tente novamente.");

  return NextResponse.redirect(url);
});
