import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------
// Geração automática de SKU.
//
// Produto:  GF-0001, GF-0002, ... (sequencial, único no catálogo).
// Variação: <SKU do produto>-<TAM>-<COR>  (ex.: GF-0001-P-PRETO).
//
// O SKU do produto é a fonte de verdade; se o lojista digitar um
// SKU manual, ele é respeitado. Quando o campo vem vazio, geramos.
// ---------------------------------------------------------------

const PREFIX = "GF";
const PAD = 4;

/** Normaliza um pedaço de texto para compor SKU (maiúsculo, sem acento/símbolo). */
function seg(v?: string | null): string {
  if (!v) return "";
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas diacríticas)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "") // só letras e números
    .slice(0, 8);
}

/**
 * Gera o próximo SKU sequencial de produto (GF-0001...), garantindo
 * que não colida com nenhum SKU já existente no catálogo.
 */
export async function generateProductSku(): Promise<string> {
  const rows = await prisma.product.findMany({
    where: { sku: { startsWith: `${PREFIX}-` } },
    select: { sku: true },
  });

  let max = 0;
  const taken = new Set<string>();
  for (const r of rows) {
    if (!r.sku) continue;
    taken.add(r.sku);
    const n = parseInt(r.sku.slice(PREFIX.length + 1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }

  let next = max + 1;
  // pula números que porventura já estejam ocupados (SKUs manuais)
  while (taken.has(`${PREFIX}-${String(next).padStart(PAD, "0")}`)) next++;
  return `${PREFIX}-${String(next).padStart(PAD, "0")}`;
}

/**
 * Deriva o SKU de uma variação a partir do SKU do produto.
 * Ex.: ("GF-0001", "P", "Preto") -> "GF-0001-P-PRETO".
 * Sem tamanho/cor, usa um índice: "GF-0001-V2".
 */
export function buildVariantSku(
  productSku: string,
  index: number,
  size?: string | null,
  color?: string | null
): string {
  const parts = [seg(size), seg(color)].filter(Boolean);
  const suffix = parts.length > 0 ? parts.join("-") : `V${index + 1}`;
  return `${productSku}-${suffix}`;
}
