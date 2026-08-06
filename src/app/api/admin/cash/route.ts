import { NextResponse } from "next/server";
import { handler } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/session";
import { cashActionSchema } from "@/lib/validations";
import {
  getOpenSession,
  openCashSession,
  addCashMovement,
  closeCashSession,
  cashSummary,
} from "@/services/cash";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

/** GET /api/admin/cash — caixa aberto do operador + resumo */
export const GET = handler(async () => {
  const admin = await requirePermission("cash.operate");
  const session = await getOpenSession(admin.id);
  if (!session) return NextResponse.json({ session: null });
  const summary = await cashSummary(session.id);
  return NextResponse.json({ session, summary });
});

/** POST /api/admin/cash — abrir / fechar / sangria / suprimento */
export const POST = handler(async (req) => {
  const admin = await requirePermission("cash.operate");
  const body = cashActionSchema.parse(await req.json());

  if (body.action === "open") {
    const session = await openCashSession({ operatorId: admin.id, openingCents: body.openingCents });
    await audit({ userId: admin.id, action: "cash.open", entity: "CashSession", entityId: session.id, ip: getClientIp(req) });
    return NextResponse.json({ ok: true, session }, { status: 201 });
  }

  if (body.action === "close") {
    const session = await closeCashSession({
      sessionId: body.sessionId,
      operatorId: admin.id,
      closingCents: body.closingCents,
      note: body.note || null,
    });
    const summary = await cashSummary(session.id);
    await audit({ userId: admin.id, action: "cash.close", entity: "CashSession", entityId: session.id, detail: { closingCents: body.closingCents, esperado: summary.saldoCents }, ip: getClientIp(req) });
    return NextResponse.json({ ok: true, session, summary });
  }

  // sangria | suprimento
  const type = body.action === "sangria" ? "SANGRIA" : "SUPRIMENTO";
  await addCashMovement({
    sessionId: body.sessionId,
    operatorId: admin.id,
    type,
    amountCents: body.amountCents,
    note: body.note || null,
  });
  await audit({ userId: admin.id, action: `cash.${body.action}`, entity: "CashSession", entityId: body.sessionId, detail: { amountCents: body.amountCents }, ip: getClientIp(req) });
  const summary = await cashSummary(body.sessionId);
  return NextResponse.json({ ok: true, summary });
});
