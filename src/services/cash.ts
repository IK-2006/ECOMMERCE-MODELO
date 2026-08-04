import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";

// ---------------------------------------------------------------
// Caixa do PDV (estilo ERP): abertura → movimentos → fechamento.
//   Saldo em dinheiro = abertura + vendas em dinheiro + suprimentos − sangrias.
//   (Pix/cartão não entram no caixa físico — vão pro banco.)
// ---------------------------------------------------------------

/** Sessão de caixa ABERTA do operador (ou null). */
export async function getOpenSession(operatorId: string) {
  return prisma.cashSession.findFirst({
    where: { operatorId, status: "ABERTO" },
    orderBy: { openedAt: "desc" },
  });
}

/** Abre um caixa com o fundo de troco informado. */
export async function openCashSession(params: {
  operatorId: string;
  openingCents: number;
}) {
  const existing = await getOpenSession(params.operatorId);
  if (existing) throw new ApiError(409, "Já existe um caixa aberto para este operador.");
  return prisma.cashSession.create({
    data: { operatorId: params.operatorId, openingCents: Math.max(0, params.openingCents) },
  });
}

/** Sangria (retirada) ou suprimento (aporte) de dinheiro. */
export async function addCashMovement(params: {
  sessionId: string;
  operatorId: string;
  type: "SANGRIA" | "SUPRIMENTO";
  amountCents: number;
  note?: string | null;
}) {
  const session = await prisma.cashSession.findUnique({ where: { id: params.sessionId } });
  if (!session || session.operatorId !== params.operatorId)
    throw new ApiError(404, "Caixa não encontrado.");
  if (session.status !== "ABERTO") throw new ApiError(409, "O caixa já está fechado.");
  if (params.amountCents <= 0) throw new ApiError(400, "Informe um valor maior que zero.");
  return prisma.cashMovement.create({
    data: {
      sessionId: params.sessionId,
      type: params.type,
      amountCents: params.amountCents,
      note: params.note ?? null,
    },
  });
}

export interface CashSummary {
  openingCents: number;
  vendasCents: number;
  suprimentosCents: number;
  sangriasCents: number;
  saldoCents: number; // dinheiro esperado na gaveta
}

/** Resumo financeiro do caixa (saldo esperado em dinheiro). */
export async function cashSummary(sessionId: string): Promise<CashSummary> {
  const movements = await prisma.cashMovement.findMany({ where: { sessionId } });
  const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new ApiError(404, "Caixa não encontrado.");

  let vendas = 0;
  let suprimentos = 0;
  let sangrias = 0;
  for (const m of movements) {
    if (m.type === "VENDA") vendas += m.amountCents;
    else if (m.type === "SUPRIMENTO") suprimentos += m.amountCents;
    else if (m.type === "SANGRIA") sangrias += m.amountCents;
  }
  return {
    openingCents: session.openingCents,
    vendasCents: vendas,
    suprimentosCents: suprimentos,
    sangriasCents: sangrias,
    saldoCents: session.openingCents + vendas + suprimentos - sangrias,
  };
}

/** Fecha o caixa registrando o valor contado (para conferência). */
export async function closeCashSession(params: {
  sessionId: string;
  operatorId: string;
  closingCents: number;
  note?: string | null;
}) {
  const session = await prisma.cashSession.findUnique({ where: { id: params.sessionId } });
  if (!session || session.operatorId !== params.operatorId)
    throw new ApiError(404, "Caixa não encontrado.");
  if (session.status !== "ABERTO") throw new ApiError(409, "O caixa já está fechado.");
  return prisma.cashSession.update({
    where: { id: params.sessionId },
    data: {
      status: "FECHADO",
      closingCents: Math.max(0, params.closingCents),
      closedAt: new Date(),
      note: params.note || session.note,
    },
  });
}
