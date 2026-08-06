import { z } from "zod";

// ---------------------------------------------------------------
// Schemas Zod — única fonte de verdade para validação de inputs.
// Todos os endpoints validam o body com estes schemas antes de
// tocar no banco (proteção contra injeção/dados malformados).
// ---------------------------------------------------------------

export const cepSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 8, "CEP inválido");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(100)
    .regex(/[a-zA-Z]/, "A senha deve conter letras")
    .regex(/[0-9]/, "A senha deve conter números"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: registerSchema.shape.password,
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  cpf: z.string().trim().max(14).optional().or(z.literal("")),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: registerSchema.shape.password,
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Casa"),
  recipient: z.string().trim().min(2, "Informe o destinatário").max(120),
  cep: cepSchema,
  street: z.string().trim().min(2, "Informe a rua").max(200),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().min(1, "Informe o bairro").max(100),
  city: z.string().trim().min(1, "Informe a cidade").max(100),
  state: z.string().trim().length(2, "UF inválida"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  isDefault: z.boolean().optional().default(false),
});

export const cartItemSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

export const updateCartItemSchema = z.object({
  itemId: z.string().cuid(),
  quantity: z.number().int().min(0).max(99), // 0 remove o item
});

export const reviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  comment: z.string().trim().min(5, "Comentário muito curto").max(2000),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40),
});

export const shippingQuoteSchema = z.object({
  cep: cepSchema,
});

export const checkoutSchema = z.object({
  addressId: z.string().cuid().optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().optional().default(false),
  shippingService: z.string().trim().min(1).max(60),
  couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal("")),
}).refine((d) => d.shippingService === "retirada" || d.addressId || d.address, {
  message: "Informe um endereço de entrega",
});

// ------------------------------ Admin ---------------------------

export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Slug inválido").max(220).optional(),
  description: z.string().trim().min(10, "Descrição muito curta").max(10000),
  priceCents: z.number().int().min(1, "Preço obrigatório"),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).nullable().optional(), // alerta de estoque mínimo
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  weightGrams: z.number().int().min(1).default(300),
  lengthCm: z.number().int().min(1).max(100).default(20),
  widthCm: z.number().int().min(1).max(100).default(15),
  heightCm: z.number().int().min(1).max(100).default(10),
  categoryId: z.string().cuid(),
  images: z
    .array(z.object({ url: z.string().min(1), alt: z.string().optional() }))
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string().cuid().optional(),
        name: z.string().trim().min(1).max(80),
        size: z.string().trim().max(30).optional().or(z.literal("")),
        color: z.string().trim().max(30).optional().or(z.literal("")),
        sku: z.string().trim().max(60).optional().or(z.literal("")),
        priceCents: z.number().int().min(1).nullable().optional(),
        stock: z.number().int().min(0).default(0),
      })
    )
    .default([]),
});

// Reembolso / devolução — solicitação do cliente
export const refundRequestSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.enum(["ARREPENDIMENTO", "DEFEITO", "TAMANHO", "ERRO_ENVIO", "OUTRO"]),
  description: z
    .string()
    .trim()
    .min(10, "Descreva o motivo com pelo menos 10 caracteres")
    .max(1000),
});

// Reembolso — resolução pelo admin
export const refundResolveSchema = z.object({
  status: z.enum(["EM_ANALISE", "APROVADO", "RECUSADO", "CONCLUIDO"]),
  adminNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

// Venda no balcão (PDV / "Venda em Loja")
export const storeSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().nullable().optional(),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1, "Adicione ao menos um item"),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito"]),
  discountCents: z.number().int().min(0).default(0),
  amountReceivedCents: z.number().int().min(0).nullable().optional(),
  cashSessionId: z.string().cuid().optional(),
  fiscalCpf: z.string().trim().max(14).optional().or(z.literal("")),
});

// Ações do caixa do PDV (abrir, fechar, sangria, suprimento)
export const cashActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    openingCents: z.number().int().min(0).max(100_000_000).default(0),
  }),
  z.object({
    action: z.literal("close"),
    sessionId: z.string().cuid(),
    closingCents: z.number().int().min(0).max(100_000_000),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  }),
  z.object({
    action: z.enum(["sangria", "suprimento"]),
    sessionId: z.string().cuid(),
    amountCents: z.number().int().min(1).max(100_000_000),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  }),
]);

// Gestão de usuários (RBAC — Fase 1)
// Papéis atribuíveis pela tela (staff). Atribuir ADMIN é permitido no schema,
// mas a ROTA só deixa um ADMIN fazê-lo (impede escalonamento de privilégio).
const assignableRole = z.enum(["ADMIN", "GERENTE", "CAIXA", "ESTOQUISTA", "FINANCEIRO"]);

// Criação por convite: sem senha — o funcionário define a dele pelo link enviado.
export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  role: assignableRole,
});

// Edição: nome, papel e/ou status (todos opcionais — atualização parcial).
export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Nome muito curto").max(120).optional(),
    role: assignableRole.optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.role !== undefined || d.active !== undefined, {
    message: "Nada para atualizar",
  });

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

// Entrada de mercadoria (compra) — sobe estoque com custo + fornecedor
export const stockEntrySchema = z.object({
  supplierId: z.string().cuid().optional().or(z.literal("")),
  note: z.string().trim().max(200).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().nullable().optional(),
        quantity: z.number().int().min(1).max(1_000_000),
        costCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
      })
    )
    .min(1, "Adicione ao menos um item"),
});

// Fiscal (Fase 6) — emissão de nota
export const fiscalEmitSchema = z.object({
  type: z.enum(["NFCE", "NFE"]),
});

// CRM (Fase 5) — tags/segmentação + notas do cliente
export const customerProfileSchema = z.object({
  tags: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

// Inventário / balanço (Fase 4) — define o estoque contado de vários itens
export const inventorySchema = z.object({
  counts: z
    .array(
      z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().nullable().optional(),
        countedStock: z.number().int().min(0).max(1_000_000),
      })
    )
    .min(1, "Informe ao menos um item contado"),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(120).optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  position: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/, "Use letras e números").min(2).max(40),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    percent: z.number().int().min(1).max(100).nullable().optional(),
    valueCents: z.number().int().min(1).nullable().optional(),
    minOrderCents: z.number().int().min(0).nullable().optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
    perUserLimit: z.number().int().min(1).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    active: z.boolean().default(true),
  })
  .refine((c) => c.type !== "PERCENT" || !!c.percent, {
    message: "Informe o percentual de desconto",
    path: ["percent"],
  })
  .refine((c) => c.type !== "FIXED" || !!c.valueCents, {
    message: "Informe o valor do desconto",
    path: ["valueCents"],
  });

export const shippingRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  service: z.enum(["PAC", "SEDEX"]),
  cepStart: cepSchema,
  cepEnd: cepSchema,
  minWeightGrams: z.number().int().min(0).default(0),
  maxWeightGrams: z.number().int().min(1).default(30000),
  priceCents: z.number().int().min(0),
  days: z.number().int().min(1).max(60),
  active: z.boolean().default(true),
});

export const stockUpdateSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().nullable().optional(),
  newStock: z.number().int().min(0).max(1_000_000),
  reason: z
    .enum(["RESTOCK", "ADJUST", "CORRECTION"])
    .optional()
    .default("ADJUST"),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    "AGUARDANDO_PAGAMENTO",
    "PAGO",
    "EM_SEPARACAO",
    "ENVIADO",
    "ENTREGUE",
    "CANCELADO",
    "REEMBOLSADO",
  ]),
  trackingCode: z.string().trim().max(60).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// ------------------------------ Financeiro (Fase 2) ------------------------------

export const financialAccountSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  kind: z.enum(["CAIXA", "BANCO", "GATEWAY"]),
  active: z.boolean().default(true),
});

export const financialCategorySchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  type: z.enum(["INCOME", "EXPENSE"]),
  active: z.boolean().default(true),
});

// Lançamento manual (a pagar/receber ou já realizado).
export const financialEntrySchema = z
  .object({
    direction: z.enum(["INCOME", "EXPENSE"]),
    amountCents: z.number().int().min(1, "Informe um valor").max(1_000_000_000),
    description: z.string().trim().min(2, "Descreva o lançamento").max(200),
    categoryId: z.string().cuid().optional().or(z.literal("")),
    supplierId: z.string().cuid().optional().or(z.literal("")),
    accountId: z.string().cuid().optional().or(z.literal("")),
    dueDate: z.coerce.date().nullable().optional(),
    status: z.enum(["PENDING", "PAID"]).default("PENDING"),
    paidDate: z.coerce.date().nullable().optional(),
  })
  .refine((d) => d.status !== "PAID" || !!d.accountId, {
    message: "Informe a conta que recebeu/pagou o valor",
    path: ["accountId"],
  });

// Liquidar um lançamento pendente.
export const financialSettleSchema = z.object({
  accountId: z.string().cuid(),
  paidDate: z.coerce.date().nullable().optional(),
});

// ------------------------------ Compras (Fase 3) ------------------------------

export const purchaseOrderSchema = z.object({
  supplierId: z.string().cuid().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  expectedAt: z.coerce.date().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().nullable().optional(),
        name: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(1_000_000),
        unitCostCents: z.number().int().min(0).max(100_000_000),
      })
    )
    .min(1, "Adicione ao menos um item"),
});

// Ação sobre a OC (enviar / cancelar).
export const purchaseActionSchema = z.object({
  action: z.enum(["send", "cancel"]),
});

// Recebimento (parcial ou total).
export const purchaseReceiveSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        qty: z.number().int().min(1).max(1_000_000),
        unitCostCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
      })
    )
    .min(1, "Informe ao menos um item recebido"),
});
