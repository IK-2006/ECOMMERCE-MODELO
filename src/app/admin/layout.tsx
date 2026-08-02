import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = { title: "Painel administrativo" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // dupla proteção: o middleware já bloqueia, aqui garantimos de novo
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar userName={user.name ?? "Admin"} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
