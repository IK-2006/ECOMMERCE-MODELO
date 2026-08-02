import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProfileForms } from "./ProfileForms";
import { TwoFactorSettings } from "@/components/store/TwoFactorSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus dados" };

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/entrar");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      phone: true,
      cpf: true,
      passwordHash: true,
      twoFactorEnabled: true,
    },
  });
  if (!user) redirect("/entrar");

  return (
    <div className="space-y-10">
      <ProfileForms
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          cpf: user.cpf ?? "",
          hasPassword: !!user.passwordHash,
        }}
      />
      {user.passwordHash && <TwoFactorSettings enabled={user.twoFactorEnabled} />}
    </div>
  );
}
