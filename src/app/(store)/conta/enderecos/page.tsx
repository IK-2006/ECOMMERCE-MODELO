import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { AddressManager } from "./AddressManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AddressManager
      initialAddresses={addresses.map((a) => ({
        id: a.id,
        label: a.label,
        recipient: a.recipient,
        cep: a.cep,
        street: a.street,
        number: a.number,
        complement: a.complement ?? "",
        district: a.district,
        city: a.city,
        state: a.state,
        phone: a.phone ?? "",
        isDefault: a.isDefault,
      }))}
    />
  );
}
