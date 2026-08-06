import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { UserManager } from "@/components/admin/UserManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuários" };

export default async function UsersPage() {
  const actor = await requirePagePermission("users.manage");

  const users = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    // seleção explícita — passwordHash só deriva "pendingInvite" e não vai ao cliente
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      twoFactorEnabled: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  const data = users.map(({ passwordHash, createdAt, ...u }) => ({
    ...u,
    createdAt: createdAt.toISOString(),
    pendingInvite: passwordHash === null,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Convide sua equipe e defina o que cada pessoa pode acessar. O convidado recebe
          um e-mail para definir a própria senha.
        </p>
      </div>
      <UserManager users={data} currentUserId={actor.id} currentUserRole={actor.role} />
    </div>
  );
}
