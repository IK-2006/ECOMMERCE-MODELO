import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProductCard } from "@/components/store/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { toCardData, productCardInclude } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lista de desejos" };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?callbackUrl=/favoritos");

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, active: true },
    include: productCardInclude,
  });
  const wishedIds = new Set(products.map((p) => p.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Lista de desejos</h1>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="❤️"
            title="Sua lista de desejos está vazia"
            description="Toque no coração de um produto para salvá-lo aqui."
            action={
              <Link href="/produtos">
                <Button>Explorar produtos</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={toCardData(p, wishedIds)} />
          ))}
        </div>
      )}
    </div>
  );
}
