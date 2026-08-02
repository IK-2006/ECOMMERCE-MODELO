// ---------------------------------------------------------------
// Abstração de transportadoras.
//
// Implementações:
//   - CorreiosProvider  (API oficial CWS — exige contrato)
//   - FallbackProvider  (tabela de frete interna, cadastrável no admin)
//
// Para adicionar Melhor Envio (ou outra), crie um novo provider
// implementando ShippingProvider e registre-o em index.ts.
// ---------------------------------------------------------------

export interface ShippingPackage {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** valor declarado em centavos (para seguro) */
  declaredValueCents: number;
}

export interface ShippingQuote {
  carrier: string; // CORREIOS | TABELA_INTERNA | MELHOR_ENVIO | ...
  /** código estável do serviço (ex.: "PAC", "SEDEX", "me-1"); usado para
      casar a opção escolhida na recotação do checkout */
  service: string;
  serviceName: string; // rótulo exibido ao cliente (ex.: "PAC — Correios")
  priceCents: number;
  days: number; // prazo em dias úteis
}

export interface TrackingEvent {
  date: string;
  status: string;
  location?: string;
}

export interface ShippingProvider {
  readonly name: string;
  /** Cotação de frete. Retorna [] se nenhum serviço atender. */
  quote(cepDestino: string, pkg: ShippingPackage): Promise<ShippingQuote[]>;
  /** Eventos de rastreio de um objeto. */
  track(trackingCode: string): Promise<TrackingEvent[]>;
}
