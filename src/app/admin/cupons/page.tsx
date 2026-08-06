import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-guard";
import { CouponManager } from "@/components/admin/CouponManager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requirePagePermission("coupons.write");
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 font-serif text-3xl font-medium tracking-tight">Cupons de desconto</h1>
      <CouponManager
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description ?? "",
          type: c.type as "PERCENT" | "FIXED" | "FREE_SHIPPING",
          percent: c.percent,
          valueCents: c.valueCents,
          minOrderCents: c.minOrderCents,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          perUserLimit: c.perUserLimit,
          startsAt: c.startsAt?.toISOString().slice(0, 10) ?? "",
          expiresAt: c.expiresAt?.toISOString().slice(0, 10) ?? "",
          active: c.active,
        }))}
      />
    </div>
  );
}
