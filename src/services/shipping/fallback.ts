import { prisma } from "@/lib/prisma";
import type {
  ShippingPackage,
  ShippingProvider,
  ShippingQuote,
  TrackingEvent,
} from "./types";

// ---------------------------------------------------------------
// Provider de frete por TABELA INTERNA (ShippingRule).
// Usado automaticamente quando não há credenciais dos Correios no
// .env — permite operar a loja sem contrato, com faixas de CEP,
// peso e preço cadastráveis no painel admin (/admin/frete).
// ---------------------------------------------------------------

export class FallbackProvider implements ShippingProvider {
  readonly name = "TABELA_INTERNA";

  async quote(cepDestino: string, pkg: ShippingPackage): Promise<ShippingQuote[]> {
    const weight = Math.max(1, pkg.weightGrams);

    const rules = await prisma.shippingRule.findMany({
      where: {
        active: true,
        cepStart: { lte: cepDestino },
        cepEnd: { gte: cepDestino },
        minWeightGrams: { lte: weight },
        maxWeightGrams: { gte: weight },
      },
      orderBy: { priceCents: "asc" },
    });

    // uma cotação por serviço (a regra mais barata que atende)
    const byService = new Map<string, (typeof rules)[number]>();
    for (const rule of rules) {
      if (!byService.has(rule.service)) byService.set(rule.service, rule);
    }

    return [...byService.values()].map((rule) => ({
      carrier: this.name,
      service: rule.service as "PAC" | "SEDEX",
      serviceName:
        rule.service === "PAC" ? "Envio Econômico (PAC)" : "Envio Expresso (SEDEX)",
      priceCents: rule.priceCents,
      days: rule.days,
    }));
  }

  async track(_trackingCode: string): Promise<TrackingEvent[]> {
    // Sem contrato com transportadora não há rastreio automático;
    // o admin atualiza o status do pedido manualmente.
    return [];
  }
}
