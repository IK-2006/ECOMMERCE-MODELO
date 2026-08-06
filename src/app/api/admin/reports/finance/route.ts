import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { financeEntriesCsv } from "@/services/reports";

/** GET /api/admin/reports/finance?inicio=&fim= — CSV dos lançamentos financeiros. */
export const GET = handler(async (req) => {
  await requirePermission("reports.read");
  const url = new URL(req.url);
  const parse = (v: string | null, fallback: Date, end = false) => {
    if (!v) return fallback;
    const d = new Date(`${v}T${end ? "23:59:59.999" : "00:00:00"}`);
    return isNaN(d.getTime()) ? fallback : d;
  };
  const from = parse(url.searchParams.get("inicio"), new Date(Date.now() - 30 * 864e5));
  const to = parse(url.searchParams.get("fim"), new Date(), true);

  const csv = await financeEntriesCsv({ from, to });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
