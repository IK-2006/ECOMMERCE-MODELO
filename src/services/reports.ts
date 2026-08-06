import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------
// Relatórios (Fase 7). Agregações reaproveitáveis sobre os dados
// existentes (pedidos, estoque, financeiro). Os CSVs seguem o padrão
// do relatório de vendas (separador ; + BOM UTF-8 p/ Excel BR).
// ---------------------------------------------------------------

const PAID_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];

export interface AbcRow {
  name: string;
  revenueCents: number;
  qty: number;
  cumulativePct: number;
  klass: "A" | "B" | "C";
}

/**
 * Curva ABC: produtos ordenados pela contribuição no faturamento do período.
 * Classe A ≈ 80% do faturamento, B até 95%, C o restante (regra de Pareto).
 */
export async function abcCurve(params: { from: Date; to: Date }): Promise<AbcRow[]> {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: { in: PAID_STATUSES }, paidAt: { gte: params.from, lte: params.to } } },
    select: { name: true, quantity: true, unitPriceCents: true },
  });

  const map = new Map<string, { revenueCents: number; qty: number }>();
  for (const it of items) {
    const r = map.get(it.name) ?? { revenueCents: 0, qty: 0 };
    r.revenueCents += it.unitPriceCents * it.quantity;
    r.qty += it.quantity;
    map.set(it.name, r);
  }

  const rows = [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
  const total = rows.reduce((s, r) => s + r.revenueCents, 0);

  let cum = 0;
  return rows.map((r) => {
    cum += r.revenueCents;
    const cumulativePct = total ? (cum / total) * 100 : 0;
    const klass: "A" | "B" | "C" = cumulativePct <= 80 ? "A" : cumulativePct <= 95 ? "B" : "C";
    return { ...r, cumulativePct, klass };
  });
}

// ------------------------------ CSV helpers ------------------------------

export const CSV_BOM = "﻿";
export const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
export const csvEsc = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** CSV da posição/valorização de estoque (produto e variação). */
export async function stockValuationCsv(): Promise<string> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { variants: { where: { active: true }, orderBy: { name: "asc" } } },
  });

  const header = ["Produto", "Variação", "SKU", "Estoque", "Custo (R$)", "Valor em estoque (R$)"].join(";");
  const rows: string[] = [];
  const push = (name: string, variant: string, sku: string | null, stock: number, cost: number | null) => {
    const valuation = cost != null ? cost * stock : 0;
    rows.push(
      [csvEsc(name), csvEsc(variant), sku ?? "", stock, cost != null ? money(cost) : "", money(valuation)].join(";")
    );
  };
  for (const p of products) {
    if (p.variants.length > 0) {
      for (const v of p.variants) push(p.name, v.name, v.sku ?? p.sku, v.stock, v.costCents ?? p.costCents);
    } else {
      push(p.name, "", p.sku, p.stock, p.costCents);
    }
  }
  return CSV_BOM + [header, ...rows].join("\n");
}
