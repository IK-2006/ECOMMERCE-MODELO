import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const customers = await prisma.user.findMany({
    where: {
      ...(q && { OR: [{ name: { contains: q } }, { email: { contains: q } }] }),
    },
    include: {
      orders: { select: { totalCents: true, status: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Clientes</h1>
        <form method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou e-mail..."
            className="h-10 w-64 rounded-none border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-none border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="adm-table w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
              <th className="p-4 font-medium">Cliente</th>
              <th className="p-4 font-medium">Cadastro</th>
              <th className="p-4 font-medium">Pedidos</th>
              <th className="p-4 font-medium">Total gasto</th>
              <th className="p-4 font-medium">Perfil</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const paid = c.orders.filter((o) =>
                ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"].includes(o.status)
              );
              const spent = paid.reduce((s, o) => s + o.totalCents, 0);
              return (
                <tr
                  key={c.id}
                  className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                >
                  <td className="p-4">
                    <Link href={`/admin/clientes/${c.id}`} className="block">
                      <p className="font-medium hover:text-accent">{c.name}</p>
                      <p className="text-xs text-zinc-400">{c.email}</p>
                    </Link>
                  </td>
                  <td className="p-4 text-zinc-500">{formatDate(c.createdAt)}</td>
                  <td className="p-4">{c._count.orders}</td>
                  <td className="p-4 font-medium">{formatCurrency(spent)}</td>
                  <td className="p-4">
                    {c.role === "ADMIN" ? (
                      <Badge className="bg-accent-soft text-accent dark:bg-accent-soft-dark">Admin</Badge>
                    ) : (
                      <Badge>Cliente</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
