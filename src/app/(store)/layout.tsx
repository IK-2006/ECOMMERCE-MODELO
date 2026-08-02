import { prisma } from "@/lib/prisma";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";
import { whatsappLink } from "@/lib/store-config";
import { Analytics } from "@/components/tracking/Analytics";
import { ConsentBanner } from "@/components/tracking/ConsentBanner";
import { hasClientTracking } from "@/lib/tracking";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
    select: { name: true, slug: true },
    take: 8,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton href={whatsappLink("Olá! Vim pela loja Gata Fit e gostaria de tirar uma dúvida.")} />
      {hasClientTracking && (
        <>
          <Analytics />
          <ConsentBanner />
        </>
      )}
    </div>
  );
}
