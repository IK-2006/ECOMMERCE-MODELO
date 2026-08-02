import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";

const toggleSchema = z.object({ productId: z.string().cuid() });

/** POST /api/wishlist — alterna produto na lista de desejos */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { productId } = toggleSchema.parse(await req.json());

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, "Produto não encontrado");

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ wished: false });
  }

  await prisma.wishlistItem.create({ data: { userId: user.id, productId } });
  return NextResponse.json({ wished: true });
});
