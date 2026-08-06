# Plano de Evolução: E-commerce → ERP Profissional

> **Documento de arquitetura — Etapas 1, 2 e 3 (análise, comparação e roadmap).**
> Elaborado a partir da leitura do código real do projeto (schema Prisma, serviços,
> APIs, autenticação, RBAC, PDV, estoque, pedidos, dashboard e relatórios).
> **Nenhum código foi alterado.** Este é um documento de decisão.

---

## Sumário

- [Etapa 1 — Análise completa do sistema atual](#etapa-1--análise-completa-do-sistema-atual)
- [Etapa 2 — Comparação com ERPs de mercado](#etapa-2--comparação-com-erps-de-mercado)
- [Etapa 3 — Roadmap por fases](#etapa-3--roadmap-por-fases)
- [Recomendação de ponto de partida](#recomendação-de-ponto-de-partida)

---

# ETAPA 1 — Análise completa do sistema atual

## 1.0 Retrato técnico (stack e arquitetura)

| Camada | Tecnologia | Observação |
|---|---|---|
| Framework | **Next.js 16 (App Router)** + React 19 | Server Components por padrão, Route Handlers para API |
| Linguagem | **TypeScript strict** | `strict: true`, path alias `@/*` |
| ORM / Banco | **Prisma 6** — SQLite (dev) / PostgreSQL (prod) | Dinheiro em **centavos (Int)** para compatibilidade dos dois bancos |
| Auth | **NextAuth 4** (JWT) — Credentials + Google | 2FA TOTP próprio, expiração de sessão admin |
| Validação | **Zod** (`src/lib/validations.ts`) | Fonte única de verdade dos inputs |
| Pagamentos | **Mercado Pago** (online) + PDV (dinheiro/pix/cartão) | Webhook idempotente |
| Frete | **Correios (CWS)** + **Melhor Envio** + tabela interna | Fallback em cascata |
| E-mail | Nodemailer / Brevo | Transacional (pedido, envio, entrega) |
| Notificações | WhatsApp (link/API) + Meta CAPI | Server-side tracking |
| Observabilidade | **Sentry** | `captureException` no handler central |

**Padrão arquitetural real do projeto (e que deve ser mantido):**

```
Route Handler (validação Zod + requireAdmin)  ← camada fina
        │
        ▼
Service (regra de negócio + transação Prisma)  ← src/services/*
        │
        ▼
Prisma Client (src/lib/prisma.ts)              ← acesso a dados
        │
        ▼
Auditoria (src/lib/audit.ts) — não-bloqueante
```

O projeto **já pratica Service Layer + validação centralizada + auditoria**. Ele
não segue Repository Pattern formal (usa Prisma direto dentro dos services), o que
é uma escolha pragmática e correta para o porte — **não recomendo introduzir
repositórios agora** (seria over-engineering).

## 1.1 Estrutura de pastas (resumo)

```
src/
├── app/
│   ├── (store)/        → loja pública (produtos, carrinho, checkout, conta)
│   ├── admin/          → painel (produtos, pedidos, estoque, PDV, cupons,
│   │                     clientes, fornecedores, frete, reembolsos, relatórios)
│   └── api/            → route handlers (admin/*, auth, checkout, webhooks, cron)
├── components/
│   ├── admin/          → 15 componentes (PdvTerminal, StockEntryPanel, ...)
│   ├── store/ ui/ providers/
├── lib/                → auth, session, audit, validations, rate-limit, email, utils
├── services/           → orders, stock, cash, store-sale, refunds, coupons,
│                         payments/, shipping/, notifications/, tracking/
└── types/
```

## 1.2 Modelo de dados (Prisma) — o ativo mais valioso

O schema já contém **20 models**, incluindo fundações que a maioria dos e-commerces
**não tem** e que são exatamente as vigas de um ERP:

- **Catálogo:** `Product`, `ProductVariant`, `ProductImage`, `Category`
- **Estoque (ledger real):** `StockMovement` com `delta` / `resulting` / `reason` / `costCents` / `supplierId` — **razão de estoque auditável**
- **Compras (embrião):** `Supplier`, entrada com custo por `StockMovement(reason=PURCHASE)`
- **PDV / Caixa:** `CashSession`, `CashMovement` (sangria/suprimento/venda)
- **Fiscal (modelado):** `FiscalInvoice` (NFC-e/NF-e, DANFE, XML, chave, protocolo)
- **Pedidos:** `Order` (canal ONLINE/LOJA), `OrderItem`, `OrderStatusHistory`, `RefundRequest`
- **Infra:** `AuditLog`, `WebhookEvent` (idempotência)
- **Campos fiscais no produto:** `ncm`, `cest`, `origem`, `unidade`, `barcode`

> **Conclusão-chave:** o banco **já foi desenhado por alguém pensando em ERP**.
> Grande parte da "Fase 1" de fundação já está no schema — falta *ativar* e *conectar*.

---

## 1.3 — O que o sistema JÁ POSSUI

| Domínio | Estado |
|---|---|
| Loja virtual completa (catálogo, carrinho persistente, checkout, conta) | ✅ |
| Painel administrativo (17 telas) | ✅ |
| Dashboard (faturamento 30d, ticket médio, top produtos, estoque baixo) | ✅ |
| Produtos com variações, imagens, SKU, código de barras, dimensões, campos fiscais | ✅ |
| Categorias | ✅ |
| Controle de estoque com **ledger de movimentações** (razão auditável) | ✅ |
| Entrada de mercadoria (compra) com custo + fornecedor | ✅ |
| **Valorização de estoque** (custo × quantidade) na tela de estoque | ✅ |
| PDV com leitura de **código de barras** e recibo | ✅ |
| **Caixa** (abertura, sangria, suprimento, fechamento, saldo esperado) | ✅ |
| Pedidos (online + balcão) com histórico de status e efeitos colaterais | ✅ |
| Clientes (listagem + ficha) | ✅ |
| Fornecedores (CRUD) | ✅ |
| Cupons (percentual, fixo, frete grátis, limites) | ✅ |
| Mercado Pago + webhook idempotente | ✅ |
| Melhor Envio + Correios + tabela interna (etiquetas, rastreio) | ✅ |
| Reembolsos/devoluções (fluxo cliente → admin) | ✅ |
| Segurança: rate-limit, 2FA TOTP, expiração de sessão admin, headers | ✅ |
| Auditoria de ações administrativas | ✅ |
| Relatório de vendas (export CSV) | ✅ |
| Cron: expirar pedidos, atualizar rastreio | ✅ |

## 1.4 — O que está MUITO BEM implementado (não mexer no núcleo)

1. **Motor de baixa de estoque (`services/orders.ts`, `store-sale.ts`).**
   Reserva atômica via `updateMany({ where: { stock: { gte } } }) + count` — **impede
   overselling** sob concorrência sem lock pessimista. Excelente.
2. **Idempotência de estados (`updateOrderStatus`).** Guarda contra toggle de status
   (CANCELADO→PAGO→CANCELADO) para não inflar estoque nem contador de cupom. Raro de
   ver e feito certo.
3. **Ledger de estoque (`StockMovement`).** Toda mudança grava `delta`, `resulting`,
   `reason`, `custo`, `usuário`, `pedido`. Isto é base para inventário, curva ABC,
   custo médio e conferência — **é o coração de um ERP e já existe.**
4. **Preços sempre do banco.** PDV e checkout **nunca** confiam no preço do cliente.
5. **Webhook Mercado Pago idempotente** (`WebhookEvent` com unique composto).
6. **Validação Zod centralizada** — uma única fonte de verdade, inclusive
   `discriminatedUnion` para ações de caixa.
7. **Tratamento de erro central (`api-helpers.ts`)** — mapeia Prisma P2002/P2003/P2025,
   ZodError, AuthError → HTTP correto, com Sentry.
8. **Auditoria não-bloqueante** — nunca derruba a operação principal.
9. **Segurança madura** — 2FA, rate-limit por e-mail/IP, sessão admin com expiração,
   IP real do XFF tratado corretamente.

## 1.5 — O que está INCOMPLETO

| Item | Situação real |
|---|---|
| **Fiscal (NF-e/NFC-e)** | `FiscalInvoice` existe no schema, mas **não há serviço nem rota que o utilize** — nenhuma emissão real. Modelado, não conectado. |
| **`minStock` (estoque mínimo)** | Campo existe e é exibido, mas os alertas do dashboard usam `≤ 5` fixo — **o mínimo por produto não dispara alerta**. |
| **Margem / lucro** | O custo (`costCents`) é capturado e usado na valorização, mas **nenhum relatório calcula margem/lucro por venda**. |
| **Compras** | Só existe *entrada direta* de mercadoria. Não há **ordem/pedido de compra** (cotação → aprovação → recebimento → contas a pagar). |
| **Financeiro** | **Não existe.** Sem contas a pagar/receber, sem fluxo de caixa consolidado (só o caixa físico do PDV), sem DRE. |
| **Gestão de usuários** | Sem tela de admin para criar/editar usuários e papéis. Papel é definido só via seed/banco. |
| **Relatórios gerenciais** | Só um CSV de vendas. Faltam: estoque/valorização exportável, compras, curva ABC, financeiro, fiscal. |
| **Alertas de estoque em variações** | O dashboard conta baixo estoque só de produtos **sem** variação (`variants: { none: {} }`). |

## 1.6 — O que está MAL ESTRUTURADO (poucos pontos — o código é limpo)

Sendo honesto: **estruturalmente o projeto é sólido.** Os pontos abaixo são dívidas
que só começam a doer quando o sistema vira ERP — não bugs.

1. **RBAC binário.** O papel é uma `String` em `User` (`CUSTOMER | ADMIN`) checada
   ad-hoc (`user.role !== "ADMIN"`). Um ERP precisa de **caixa, estoquista, gerente,
   financeiro** com permissões granulares. Isto é a fundação que mais bloqueia a
   evolução e precisa ser tratada cedo (Fase 1).
2. **Agregações de BI inline nas páginas.** `admin/page.tsx` (dashboard) monta KPIs
   direto no Server Component. Funciona, mas conforme os indicadores crescem isso
   deveria virar um **`services/analytics.ts`** reutilizável (dashboard + relatórios).
3. **Relatório carrega tudo em memória.** `reports/sales` faz `findMany` de todos os
   pedidos do período e monta o CSV em memória — ótimo hoje, ruim com dezenas de
   milhares de linhas. Streaming/paginação depois.
4. **Sem testes automatizados.** Não há suíte de testes. Para um núcleo transacional
   (estoque/caixa/pedidos) que vai crescer, testes dos serviços críticos passam a ser
   um requisito de segurança, não um luxo.

## 1.7 — O que pode ser MELHORADO

- Ativar `minStock` por produto (e por variação) nos alertas.
- Extrair um `services/analytics.ts` e reaproveitá-lo no dashboard e em relatórios.
- Consolidar o "financeiro do dia" a partir do que já existe (caixa + pedidos pagos).
- Padronizar os *status* como enums Prisma (hoje são `String` validadas por Zod) —
  **opcional**; o padrão atual é intencional e compatível com SQLite.
- Índices adicionais conforme surgirem relatórios pesados (ex.: `Order(channel, status)`).

## 1.8 — O que pode ser REAPROVEITADO (base de quase tudo que vem)

| Já existe | Reaproveitar para |
|---|---|
| `StockMovement` (ledger) | Inventário, curva ABC, custo médio, kardex, conferência |
| `createStockEntry` + `Supplier` | Recebimento de **Ordem de Compra** |
| `CashSession` / `CashMovement` | Base do **fluxo de caixa** financeiro |
| `Order` (canal ONLINE/LOJA) | **Contas a receber** (pedido pago = recebível) |
| `FiscalInvoice` (schema) | Emissão fiscal — só falta o serviço/gateway |
| `audit()` + `AuditLog` | Auditoria de todos os módulos novos (sem reescrever) |
| `handler()` + Zod + `requireAdmin()` | Todas as rotas novas seguem o mesmo molde |
| `RevenueChart`, tabelas admin, `Modal`, `Input` | UI dos novos módulos |
| Padrão de service transacional | Todo módulo novo (compras, financeiro) |

## 1.9 — O que NÃO deve ser alterado / partes CRÍTICAS

> Alterar estes pontos é alto risco. Mudanças aqui exigem testes e revisão dedicada.

1. **`services/orders.ts` — `createOrder` / `updateOrderStatus`** (reserva de estoque,
   idempotência, efeitos colaterais). **Núcleo transacional.**
2. **`services/store-sale.ts`** (venda de balcão / PDV).
3. **`services/stock.ts`** (razão de estoque). Todo novo módulo deve **chamar**
   `recordMovement`/`createStockEntry`, nunca escrever em `stock` por fora.
4. **`api/webhooks/mercadopago`** — idempotência de pagamento.
5. **`lib/auth.ts`, `lib/session.ts`, `lib/admin-session.ts`** — autenticação e 2FA.
   A evolução do RBAC deve **estender** (adicionar papéis/permissões), não reescrever.
6. **Convenção "dinheiro em centavos (Int)"** — mudar para Decimal é uma migração de
   banco de alto impacto; só considerar ao migrar 100% para Postgres, com plano próprio.

---

# ETAPA 2 — Comparação com ERPs de mercado

Comparação com o conjunto de recursos de **Tiny, Bling, Omie, MarketUP, DigiSat,
Linx, Conta Azul**. Legenda de status: ✅ possui · 🟡 parcial · ❌ não possui.

### Núcleo comercial e operação de loja

| Funcionalidade | Status | Prioridade | Complexidade | Impacto no negócio |
|---|:--:|:--:|:--:|:--:|
| Cadastro de produtos + variações + SKU + código de barras | ✅ | — | — | Alto |
| Catálogo/loja virtual | ✅ | — | — | Alto |
| PDV (frente de caixa) com leitor de código de barras | ✅ | — | — | Alto |
| Caixa (abertura/sangria/suprimento/fechamento) | ✅ | — | — | Alto |
| Multiusuário com **papéis/permissões granulares** | 🟡 | **Crítica** | Média | Alto |
| Gestão de usuários pela interface (criar/editar/papel) | ❌ | Alta | Baixa | Médio |

### Estoque e compras

| Funcionalidade | Status | Prioridade | Complexidade | Impacto |
|---|:--:|:--:|:--:|:--:|
| Movimentação de estoque auditável (kardex) | ✅ | — | — | Alto |
| Valorização de estoque (custo × qtd) | ✅ | — | — | Alto |
| Estoque mínimo com alerta automático | 🟡 | Média | Baixa | Médio |
| Inventário / balanço (contagem e ajuste em lote) | 🟡 | Média | Média | Médio |
| Fornecedores | ✅ | — | — | Médio |
| **Ordem de compra** (cotação→aprovação→recebimento) | ❌ | Alta | Média | Alto |
| Custo médio ponderado | 🟡 | Média | Média | Alto |
| Curva ABC de produtos | ❌ | Média | Baixa | Médio |
| Multi-depósito / múltiplos locais de estoque | ❌ | Baixa | Alta | Médio |

### Financeiro

| Funcionalidade | Status | Prioridade | Complexidade | Impacto |
|---|:--:|:--:|:--:|:--:|
| **Contas a pagar** | ❌ | **Crítica** | Média | Alto |
| **Contas a receber** | ❌ | **Crítica** | Média | Alto |
| Fluxo de caixa consolidado (banco + caixa físico) | 🟡 | Alta | Média | Alto |
| Categorias/plano de contas (centros de custo) | ❌ | Alta | Média | Alto |
| Conciliação de pagamentos (Mercado Pago/cartão) | 🟡 | Média | Média | Alto |
| DRE gerencial | ❌ | Média | Média | Alto |
| Margem/lucro por venda e por produto | ❌ | Alta | Baixa | Alto |

### Fiscal

| Funcionalidade | Status | Prioridade | Complexidade | Impacto |
|---|:--:|:--:|:--:|:--:|
| Campos fiscais no produto (NCM/CEST/origem/unidade) | ✅ | — | — | Alto |
| Modelo de nota fiscal (`FiscalInvoice`) | ✅ (schema) | — | — | — |
| **Emissão NFC-e** (balcão) via gateway | ❌ | Alta | Alta | Alto |
| **Emissão NF-e** (envio) via gateway | ❌ | Alta | Alta | Alto |
| Cancelamento/carta de correção | ❌ | Média | Alta | Médio |
| Regras tributárias (CFOP/CST/ICMS/PIS/COFINS) | ❌ | Alta | Alta | Alto |

### Clientes / CRM

| Funcionalidade | Status | Prioridade | Complexidade | Impacto |
|---|:--:|:--:|:--:|:--:|
| Cadastro de clientes + ficha | ✅ | — | — | Médio |
| Histórico de compras por cliente | 🟡 | Média | Baixa | Médio |
| Segmentação / tags / crédito (fiado) | ❌ | Baixa | Média | Médio |
| Cupons e promoções | ✅ | — | — | Médio |

### Relatórios e BI

| Funcionalidade | Status | Prioridade | Complexidade | Impacto |
|---|:--:|:--:|:--:|:--:|
| Dashboard de vendas | ✅ | — | — | Alto |
| Export CSV de vendas | ✅ | — | — | Médio |
| Relatórios de estoque/compras/financeiro/fiscal | ❌ | Alta | Média | Alto |
| BI (comparativos, DRE visual, metas) | ❌ | Baixa | Alta | Médio |

### Integrações

| Funcionalidade | Status | Prioridade | Complexidade | Impacto |
|---|:--:|:--:|:--:|:--:|
| Pagamento online (Mercado Pago) + webhook | ✅ | — | — | Alto |
| Frete (Correios + Melhor Envio) | ✅ | — | — | Alto |
| Marketplaces (Mercado Livre, Shopee) | ❌ | Baixa | Alta | Médio |
| Emissor fiscal (Focus NFe/Nuvem Fiscal) | ❌ | Alta | Alta | Alto |

**Leitura executiva:** o sistema **já cobre o núcleo operacional** (venda online, PDV,
caixa, estoque auditável) melhor que muitos ERPs de entrada. As lacunas que o separam
de um ERP são, em ordem: **permissões (RBAC), financeiro, compras e fiscal.**

---

# ETAPA 3 — Roadmap por fases

Ordenado por **maior valor entregue · menor risco · maior reaproveitamento**. Cada
fase é um módulo autocontido, entregável e testável isoladamente — respeitando a regra
"um módulo por vez".

### FASE 1 — Fundação ERP: RBAC + Gestão de Usuários
**Por que primeiro:** desbloqueia todas as outras fases (cada módulo novo precisa de
"quem pode ver/fazer"). Baixo risco, alto reaproveitamento (estende `auth`/`session`).
- Papéis: `ADMIN`, `GERENTE`, `CAIXA`, `ESTOQUISTA`, `FINANCEIRO` (+ CUSTOMER).
- Matriz de permissões por módulo; helper `requirePermission()` ao lado de `requireAdmin()`.
- Tela admin de usuários (criar, editar, ativar/desativar, atribuir papel).
- **Reaproveita:** `AuditLog`, `handler`, Zod, sidebar admin.
- **Não altera** o núcleo transacional — só adiciona checagem de permissão.

### FASE 2 — Financeiro (contas a pagar/receber + fluxo de caixa)
**Por que segundo:** maior valor gerencial percebido; reaproveita `Order` (recebível),
`CashSession` (caixa) e entradas de compra (a pagar).
- Models novos: `FinancialAccount`, `Payable`, `Receivable`, `FinancialCategory`.
- Pedido pago → recebível automático; entrada de compra → conta a pagar.
- Fluxo de caixa consolidando banco + caixa físico do PDV.
- Margem/lucro por venda (já temos `costCents`).

### FASE 3 — Compras (Ordem de Compra)
**Por que terceiro:** fecha o ciclo estoque↔financeiro. Reaproveita `Supplier` e
`createStockEntry` (o recebimento **é** a entrada de estoque que já existe).
- `PurchaseOrder` + itens; fluxo rascunho→enviada→recebida (parcial/total).
- Recebimento chama o `createStockEntry` existente e gera conta a pagar (Fase 2).

### FASE 4 — Estoque avançado
- Ativar `minStock` (produto e variação) nos alertas; inventário/balanço em lote;
  custo médio ponderado; curva ABC. **Tudo em cima do `StockMovement` que já existe.**

### FASE 5 — CRM
- Histórico de compras consolidado por cliente, tags/segmentação, limite de crédito
  (fiado) opcional, ficha 360°. Reaproveita `User`/`Order`/`RefundRequest`.

### FASE 6 — Fiscal (NFC-e / NF-e)
**Por que depois do financeiro:** é o de maior complexidade e risco (SEFAZ, tributação).
O modelo `FiscalInvoice` **já existe** — falta o serviço + gateway (Focus NFe/Nuvem Fiscal)
+ regras tributárias (CFOP/CST) no produto/operação. Emitir a partir do pedido/PDV.

### FASE 7 — Relatórios gerenciais
- `services/analytics.ts` reutilizável; relatórios de estoque, compras, financeiro,
  fiscal, DRE gerencial, todos exportáveis (CSV/PDF). Reaproveita o padrão do CSV atual.

### FASE 8 — Integrações
- Emissor fiscal (Fase 6), conciliação bancária/cartão, marketplaces (ML/Shopee) — opcional.

### FASE 9 — Business Intelligence
- Painel executivo: metas, comparativos período a período, DRE visual, previsões.
  Consome o `analytics` da Fase 7.

### Transversal (contínuo) — Qualidade
Testes dos serviços críticos (estoque, caixa, pedidos, financeiro), revisão de
segurança e performance a cada fase, conforme sua própria metodologia de encerramento
de módulo.

---

## Recomendação de ponto de partida

**Começar pela FASE 1 (RBAC + Usuários).** Motivos:

1. É a **única dependência dura** de todas as outras fases — sem papéis, um caixa
   consegue acessar o financeiro e um estoquista consegue dar desconto no PDV.
2. **Baixo risco:** estende a autenticação sem tocar no núcleo transacional.
3. **Alto reaproveitamento:** usa auditoria, handler e Zod já existentes.
4. Entrega valor imediato e visível ("percepção de ERP profissional") logo no primeiro
   módulo: múltiplos operadores com acessos distintos.

Se a prioridade do negócio for **gestão financeira** antes de controle de acesso, a
alternativa é inverter Fase 1 e Fase 2 — mas o RBAC continuará sendo pré-requisito para
proteger o módulo financeiro, então mesmo nesse caso eu implementaria um RBAC mínimo antes.

> **Próximo passo sugerido:** ao seu OK, elaboro o **plano detalhado da Fase 1**
> (models, migração compatível, helper de permissão, tela de usuários, matriz de
> permissões e pontos de auditoria) — ainda sem escrever código de produção até você
> aprovar o desenho.
