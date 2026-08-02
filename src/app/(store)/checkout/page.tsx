import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getCartDetailed } from "@/lib/cart";
import { getPickupOption } from "@/services/shipping";
import { storeConfig } from "@/lib/store-config";
import { CheckoutClient } from "@/components/store/CheckoutClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/entrar?callbackUrl=/checkout");

  const cart = await getCartDetailed();
  if (!cart || cart.items.length === 0) redirect("/carrinho");

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const pickupOption = getPickupOption();
  const pickup = pickupOption
    ? {
        serviceName: pickupOption.serviceName,
        days: pickupOption.days,
        address: storeConfig.pickupAddress,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold tracking-tight">Finalizar compra</h1>
      <CheckoutClient
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          recipient: a.recipient,
          cep: a.cep,
          street: a.street,
          number: a.number,
          complement: a.complement,
          district: a.district,
          city: a.city,
          state: a.state,
          phone: a.phone,
          isDefault: a.isDefault,
        }))}
        items={cart.items.map((i) => ({
          id: i.id,
          name: i.name,
          variantName: i.variantName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          imageUrl: i.imageUrl,
        }))}
        subtotalCents={cart.subtotalCents}
        pickup={pickup}
      />
    </div>
  );
}
