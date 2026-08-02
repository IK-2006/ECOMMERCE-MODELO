import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError, tooMany } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { reviewSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

/** POST /api/reviews — cria avaliação (1 por usuário/produto) */
export const POST = handler(async (req) => {
  const user = await requireUser();

  const limit = rateLimit(`review:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const body = reviewSchema.parse(await req.json());

  const product = await prisma.product.findUnique({ where: { id: body.productId } });
  if (!product || !product.active) throw new ApiError(404, "Produto não encontrado");

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: body.productId, userId: user.id } },
  });
  if (existing) throw new ApiError(409, "Você já avaliou este produto");

  // compra verificada: pedido pago/enviado/entregue contendo o produto
  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId: body.productId,
      order: { userId: user.id, status: { in: ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"] } },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        productId: body.productId,
        userId: user.id,
        rating: body.rating,
        title: body.title || null,
        comment: body.comment,
        verified: !!purchased,
      },
    });

    // atualiza agregado desnormalizado
    const stats = await tx.review.aggregate({
      where: { productId: body.productId },
      _avg: { rating: true },
      _count: true,
    });
    await tx.product.update({
      where: { id: body.productId },
      data: {
        ratingAvg: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        ratingCount: stats._count,
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
});
