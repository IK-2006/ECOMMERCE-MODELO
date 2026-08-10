// ---------------------------------------------------------------
// Máscaras / filtros de entrada (client-side).
//
// Fonte ÚNICA das máscaras de digitação. Elas restringem o que o
// usuário CONSEGUE digitar (UX) — a validação de verdade continua no
// servidor (Zod, src/lib/validations.ts). Use nos onChange dos inputs:
//   onChange={(e) => setX(filterMoneyInput(e.target.value))}
// ---------------------------------------------------------------

/** Mantém apenas os dígitos de uma string. */
export const onlyDigits = (v: string): string => v.replace(/\D/g, "");

/**
 * Filtra a digitação de um valor monetário em pt-BR: aceita só dígitos e
 * uma vírgula decimal (o último separador digitado — vírgula OU ponto — é
 * tratado como decimal; os anteriores, como milhar, são descartados).
 * Limita a 2 casas decimais. Rejeita letras e qualquer outro caractere.
 *   "abc12,5x0" → "12,50"   "1.234,56" → "1234,56"   "12.50" → "12,50"
 */
export function filterMoneyInput(v: string): string {
  const cleaned = v.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const parts = cleaned.split(",");
  if (parts.length === 1) return parts[0];
  const dec = parts.pop()!.slice(0, 2); // última seção = centavos (máx. 2)
  return `${parts.join("")},${dec}`; // seções anteriores = inteiro (milhar)
}

/** Máscara de CPF: 000.000.000-00 (progressiva). */
export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** Máscara de CNPJ: 00.000.000/0000-00 (progressiva). */
export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Máscara de CEP: 00000-000. */
export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Máscara de telefone BR: (00) 0000-0000 ou (00) 00000-0000 (celular). */
export function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
