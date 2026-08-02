import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ApiError } from "@/lib/api-helpers";
import { getCartDetailed } from "@/lib/cart";
import { cepSchema } from "@/lib/validations";
import { quoteShipping, buildPackage } from "@/services/shipping";

const quoteRequestSchema = z.object({
  cep: cepSchema,
  /** quando informado, cota para 1 unidade do produto (página de produto);
      caso contrário, cota para o carrinho inteiro (checkout) */
  productId: z.string().cuid().optional(),
});

/** POST /api/shipping/quote — { cep, productId? } -> { quotes } */
export const POST = handler(async (req) => {
  const body = quoteRequestSchema.parse(await req.json());

  let pkg;
  if (body.productId) {
    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) throw new ApiError(404, "Produto não encontrado");
    pkg = {
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      declaredValueCents: product.priceCents,
    };
  } else {
    const cart = await getCartDetailed();
    if (!cart || cart.items.length === 0) throw new ApiError(400, "Carrinho vazio");
    pkg = buildPackage(cart.items);
  }

  const quotes = await quoteShipping(body.cep, pkg);
  return NextResponse.json({ quotes });
});
