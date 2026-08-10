/**
 * Construtores de payload para a API da Focus NFe (v2). Funções PURAS —
 * recebem o pedido + itens já resolvidos com a tributação e devolvem o
 * corpo JSON que a Focus espera. Isolado do serviço para ser testável sem
 * token/credencial.
 *
 * Referência de campos: documentação Focus NFe (NFC-e /v2/nfce, NF-e /v2/nfe).
 * Os códigos tributários vêm de fiscalConfig (Simples Nacional por padrão).
 */
import { fiscalConfig } from "@/lib/fiscal-config";

const money = (cents: number) => (cents / 100).toFixed(2);

/** Pedido (campos usados na nota). */
export interface FiscalOrder {
  number: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  paymentMethod: string | null;
  fiscalCpf: string | null;
  channel: string; // LOJA (NFC-e) | ONLINE (NF-e)
  shipRecipient: string;
  shipCep: string;
  shipStreet: string;
  shipNumber: string;
  shipComplement: string | null;
  shipDistrict: string;
  shipCity: string;
  shipState: string;
  shipPhone: string | null;
}

/** Item já resolvido com a tributação (NCM/origem/unidade do produto). */
export interface FiscalItem {
  name: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  ncm: string;
  origem: string;
  unidade: string;
}

// Formas de pagamento SEFAZ (tPag). Online (gateway) = 99 (outros) quando indefinido.
const PAYMENT_CODE: Record<string, string> = {
  dinheiro: "01",
  cheque: "02",
  cartao_credito: "03",
  cartao_debito: "04",
  pix: "17",
};
export const paymentCode = (method: string | null): string =>
  (method && PAYMENT_CODE[method]) || "99";

/** Monta um item no formato Focus (tributação do Simples Nacional → CSOSN). */
function buildItem(it: FiscalItem, index: number, cfop: string) {
  const bruto = (it.unitPriceCents * it.quantity) / 100;
  return {
    numero_item: index + 1,
    codigo_produto: it.sku || String(index + 1),
    descricao: it.variantName ? `${it.name} - ${it.variantName}` : it.name,
    cfop,
    codigo_ncm: it.ncm || fiscalConfig.ncmPadrao,
    unidade_comercial: it.unidade || fiscalConfig.unidadePadrao,
    quantidade_comercial: it.quantity,
    valor_unitario_comercial: money(it.unitPriceCents),
    valor_bruto: bruto.toFixed(2),
    unidade_tributavel: it.unidade || fiscalConfig.unidadePadrao,
    quantidade_tributavel: it.quantity,
    valor_unitario_tributario: money(it.unitPriceCents),
    icms_origem: it.origem || "0",
    // Simples Nacional: CSOSN no campo icms_situacao_tributaria
    icms_situacao_tributaria: fiscalConfig.csosn,
    pis_situacao_tributaria: fiscalConfig.pisCst,
    cofins_situacao_tributaria: fiscalConfig.cofinsCst,
  };
}

/** NFC-e (venda no balcão / PDV) — consumidor presencial, sem frete. */
export function buildNfcePayload(order: FiscalOrder, items: FiscalItem[]) {
  const cpf = (order.fiscalCpf || "").replace(/\D/g, "") || undefined;
  return {
    cnpj_emitente: fiscalConfig.cnpj,
    ...(fiscalConfig.serieNfce ? { serie: fiscalConfig.serieNfce } : {}),
    natureza_operacao: fiscalConfig.naturezaOperacao,
    data_emissao: new Date().toISOString(),
    presenca_comprador: "1", // operação presencial
    modalidade_frete: "9", // sem frete
    local_destino: "1", // operação interna
    ...(cpf ? { cpf_destinatario: cpf } : {}),
    valor_total: money(order.totalCents),
    ...(order.discountCents > 0 ? { valor_desconto: money(order.discountCents) } : {}),
    formas_pagamento: [
      { forma_pagamento: paymentCode(order.paymentMethod), valor_pagamento: money(order.totalCents) },
    ],
    items: items.map((it, i) => buildItem(it, i, fiscalConfig.cfopIntra)),
  };
}

/** NF-e (venda on-line / envio) — exige destinatário com CPF. */
export function buildNfePayload(order: FiscalOrder, items: FiscalItem[]) {
  const cpf = (order.fiscalCpf || "").replace(/\D/g, "") || undefined;
  const mesmaUf = !!fiscalConfig.uf && order.shipState.toUpperCase() === fiscalConfig.uf;
  const cfop = mesmaUf ? fiscalConfig.cfopIntra : fiscalConfig.cfopInter;
  return {
    cnpj_emitente: fiscalConfig.cnpj,
    ...(fiscalConfig.serieNfe ? { serie: fiscalConfig.serieNfe } : {}),
    natureza_operacao: fiscalConfig.naturezaOperacao,
    data_emissao: new Date().toISOString(),
    tipo_documento: "1", // saída
    finalidade_emissao: "1", // normal
    consumidor_final: "1",
    presenca_comprador: "2", // operação não presencial (internet)
    local_destino: mesmaUf ? "1" : "2",
    modalidade_frete: "0", // por conta do emitente
    // destinatário (pessoa física — não contribuinte de ICMS)
    nome_destinatario: order.shipRecipient,
    ...(cpf ? { cpf_destinatario: cpf } : {}),
    indicador_inscricao_estadual_destinatario: "9",
    logradouro_destinatario: order.shipStreet,
    numero_destinatario: order.shipNumber,
    ...(order.shipComplement ? { complemento_destinatario: order.shipComplement } : {}),
    bairro_destinatario: order.shipDistrict,
    municipio_destinatario: order.shipCity,
    uf_destinatario: order.shipState.toUpperCase(),
    cep_destinatario: (order.shipCep || "").replace(/\D/g, ""),
    ...(order.shipPhone ? { telefone_destinatario: order.shipPhone.replace(/\D/g, "") } : {}),
    valor_frete: money(order.shippingCents),
    ...(order.discountCents > 0 ? { valor_desconto: money(order.discountCents) } : {}),
    valor_total: money(order.totalCents),
    modalidade_frete_valor: money(order.shippingCents),
    items: items.map((it, i) => buildItem(it, i, cfop)),
  };
}
