import { requirePageStaff } from "@/lib/page-guard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = { title: "Painel administrativo" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Acesso ao painel: qualquer papel de equipe (staff). Cada página aplica,
  // além disso, a permissão específica do seu módulo (defesa em profundidade).
  const user = await requirePageStaff();

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar userName={user.name ?? "Admin"} role={user.role} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
