/** Junta classes CSS condicionalmente (mini clsx). */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Sanitiza um callbackUrl para evitar OPEN REDIRECT (CWE-601): só aceita
 * caminho INTERNO (mesma origem). Rejeita URLs absolutas, protocolo-relativas
 * ("//host"), e o truque de barra invertida ("/\\host"). Fora do padrão → "/".
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const v = raw.trim();
  if (!v.startsWith("/")) return fallback; // precisa ser caminho relativo
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback; // protocolo-relativo / bypass
  if (/[\x00-\x1f]/.test(v)) return fallback; // caracteres de controle (CRLF etc.)
  return v;
}

/** Formata centavos como moeda brasileira: 129900 -> "R$ 1.299,00" */
export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Remove tudo que não é dígito de um CEP e valida 8 dígitos. */
export function normalizeCep(cep: string): string | null {
  const digits = cep.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function formatCep(cep: string): string {
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
}

/** Gera slug URL-safe a partir de um nome. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Número de pedido legível: PED-2026-8F3K2A */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rand = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32))
  ).join("");
  return `PED-${year}-${rand}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pagamento aprovado",
  EM_SEPARACAO: "Em separação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  REEMBOLSADO: "Reembolsado",
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS);

export const ORDER_STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  PAGO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  EM_SEPARACAO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ENVIADO: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  ENTREGUE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  CANCELADO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  REEMBOLSADO: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
};

// ---------------- Reembolso / devolução ----------------

export const REFUND_REASON_LABELS: Record<string, string> = {
  ARREPENDIMENTO: "Desisti da compra (arrependimento)",
  DEFEITO: "Produto com defeito",
  TAMANHO: "Tamanho não serviu",
  ERRO_ENVIO: "Recebi o produto errado",
  OUTRO: "Outro motivo",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  SOLICITADO: "Solicitado",
  EM_ANALISE: "Em análise",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CONCLUIDO: "Reembolso concluído",
};

export const REFUND_STATUS_COLORS: Record<string, string> = {
  SOLICITADO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  EM_ANALISE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  APROVADO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  RECUSADO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CONCLUIDO: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
};

/** Status de pedido em que o cliente ainda pode pedir reembolso/devolução. */
export const REFUNDABLE_ORDER_STATUSES = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];

/** Uma solicitação nesses status impede uma nova (já está em andamento/concluída). */
export const OPEN_REFUND_STATUSES = ["SOLICITADO", "EM_ANALISE", "APROVADO", "CONCLUIDO"];

/** Estados brasileiros para selects de endereço. */
export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;
