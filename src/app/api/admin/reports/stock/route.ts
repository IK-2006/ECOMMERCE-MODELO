import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { stockValuationCsv } from "@/services/reports";

/** GET /api/admin/reports/stock — CSV da posição/valorização de estoque. */
export const GET = handler(async () => {
  await requirePermission("reports.read");
  const csv = await stockValuationCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="estoque-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
