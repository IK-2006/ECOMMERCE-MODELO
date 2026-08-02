import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, ApiError, tooMany } from "@/lib/api-helpers";
import { requireUser } from "@/lib/session";
import { getCartDetailed } from "@/lib/cart";
import { checkoutSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCoupon } from "@/services/coupons";
import { quoteShipping, buildPackage, getPickupOption } from "@/services/shipping";
import { createOrder, type AddressSnapshot, type ShippingSelection } from "@/services/orders";
import { storeConfig } from "@/lib/store-config";
import {
  createPreference,
  isMercadoPagoConfigured,
} from "@/services/payments/mercadopago";

/**
 * POST /api/checkout
 * Valida carrinho, endereço, frete e cupom NO SERVIDOR (nunca confia em
 * valores vindos do cliente), cria o pedido e retorna a URL de pagamento:
 *  - Mercado Pago configurado -> init_point do Checkout Pro
 *  - sem credenciais          -> gateway simulado local (/checkout/simulado)
 */
export const POST = handler(async (req) => {
  const user = await requireUser();

  const ipLimit = rateLimit(`checkout:${getClientIp(req)}`, 10, 15 * 60 * 1000);
  const userLimit = rateLimit(`checkout:user:${user.id}`, 10, 15 * 60 * 1000);
  if (!ipLimit.ok || !userLimit.ok) {
    return tooMany(Math.max(ipLimit.retryAfterSeconds, userLimit.retryAfterSeconds));
  }

  const body = checkoutSchema.parse(await req.json());

  const cart = await getCartDetailed();
  if (!cart || cart.items.length === 0) throw new ApiError(400, "Carrinho vazio");

  const isPickup = body.shippingService === "retirada";

  // ----- endereço + frete (retirada é MÉTODO DE ENTREGA, não frete) -----
  let address: AddressSnapshot;
  let shipping: ShippingSelection;

  if (isPickup) {
    const pickup = getPickupOption();
    if (!pickup) throw new ApiError(400, "Retirada na loja indisponível.");
    const dbU = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true },
    });
    // sem endereço de entrega — retirada no balcão
    address = {
      recipient: dbU.name,
      cep: "",
      street: storeConfig.pickupAddress || "Retirada na loja",
      number: "-",
      complement: null,
      district: "-",
      city: "-",
      state: "",
      phone: null,
    };
    shipping = {
      carrier: pickup.carrier,
      service: pickup.service,
      serviceName: pickup.serviceName,
      priceCents: 0,
      days: pickup.days,
    };
  } else {
    if (body.addressId) {
      const saved = await prisma.address.findFirst({
        where: { id: body.addressId, userId: user.id },
      });
      if (!saved) throw new ApiError(404, "Endereço não encontrado");
      address = saved;
    } else {
      const a = body.address!;
      address = {
        recipient: a.recipient,
        cep: a.cep,
        street: a.street,
        number: a.number,
        complement: a.complement || null,
        district: a.district,
        city: a.city,
        state: a.state,
        phone: a.phone || null,
      };
      if (body.saveAddress) {
        await prisma.address.create({
          data: { ...address, label: a.label ?? "Casa", userId: user.id },
        });
      }
    }

    // frete recotado no servidor (nunca confia no cliente), excluindo a retirada
    const quotes = await quoteShipping(address.cep, buildPackage(cart.items));
    const quote = quotes.find(
      (q) => q.service === body.shippingService && q.carrier !== "RETIRADA"
    );
    if (!quote) throw new ApiError(400, "Opção de frete indisponível para este CEP");
    shipping = {
      carrier: quote.carrier,
      service: quote.service,
      serviceName: quote.serviceName,
      priceCents: quote.priceCents,
      days: quote.days,
    };
  }

  // ----- cupom (revalidado no servidor) -----
  const coupon = body.couponCode
    ? await validateCoupon(body.couponCode, user.id, cart.subtotalCents)
    : null;

  // ----- cria o pedido (reserva estoque) -----
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const order = await createOrder({
    userId: user.id,
    userEmail: dbUser.email,
    userName: dbUser.name,
    cart,
    address,
    shipping,
    coupon,
  });

  // ----- pagamento -----
  if (!isMercadoPagoConfigured()) {
    // modo simulado para testes sem credenciais
    return NextResponse.json({
      orderId: order.id,
      redirectUrl: `/checkout/simulado?pedido=${order.id}`,
    });
  }

  try {
    const preference = await createPreference({
      orderId: order.id,
      orderNumber: order.number,
      payerEmail: dbUser.email,
      payerName: dbUser.name,
      items: order.items.map((i) => ({
        id: i.productId ?? i.id,
        title: i.variantName ? `${i.name} (${i.variantName})` : i.name,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
      shippingCents: order.shippingCents,
      discountCents: order.discountCents,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { mpPreferenceId: preference.preferenceId },
    });

    return NextResponse.json({ orderId: order.id, redirectUrl: preference.initPoint });
  } catch (err) {
    console.error("[checkout] falha ao criar preferência MP:", err);
    throw new ApiError(
      502,
      "Falha ao iniciar o pagamento. Seu pedido foi criado e pode ser pago em Minha Conta > Pedidos."
    );
  }
});
