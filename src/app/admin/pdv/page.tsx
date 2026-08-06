import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { getOpenSession, cashSummary } from "@/services/cash";
import { PdvTerminal } from "@/components/admin/PdvTerminal";
import { CashControls } from "@/components/admin/CashControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venda em Loja" };

export default async function PdvPage() {
  const admin = await requirePagePermission("pos.operate");
  const [products, session] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { where: { active: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    getOpenSession(admin.id),
  ]);
  const summary = session ? await cashSummary(session.id) : null;

  const data = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    priceCents: p.priceCents,
    image: p.images[0]?.url ?? null,
    stock: p.stock,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: v.priceCents,
      stock: v.stock,
      barcode: v.barcode,
    })),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Venda em Loja</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Registre vendas do balcão (dinheiro, Pix ou cartão). O estoque baixa na hora,
          a venda entra nos relatórios e no caixa.
        </p>
      </div>

      <CashControls
        session={session ? { id: session.id } : null}
        summary={summary}
        operatorName={admin.name ?? "Operador"}
      />

      {session && <PdvTerminal products={data} sessionId={session.id} />}
    </div>
  );
}
