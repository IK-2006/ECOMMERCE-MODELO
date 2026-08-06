# Fase 2 — Desenho técnico: Financeiro

> **Documento de design. Nenhum código de produção será escrito até este desenho ser
> validado.** Objetivo: dar à loja um **financeiro de verdade** — contas a pagar,
> fluxo de caixa consolidado (loja + banco + Mercado Pago), margem/lucro e um DRE
> gerencial — **reaproveitando** o que já existe (pedidos pagos, caixa do PDV, entradas
> de compra com custo) e **sem duplicar** dados nem reescrever o núcleo transacional.

Pré-requisito atendido: RBAC da Fase 1 — o módulo nasce protegido por `finance.read` /
`finance.write` (GERENTE e FINANCEIRO já têm; CAIXA/ESTOQUISTA não).

---

## 1. Escopo

**Dentro da Fase 2 (MVP do financeiro):**
- **Contas** onde o dinheiro fica: Caixa da loja, Banco, Mercado Pago (`FinancialAccount`).
- **Plano de contas** simplificado (categorias de receita/despesa) para classificar e montar o DRE.
- **Lançamentos** (`FinancialEntry`): contas a pagar, entradas realizadas e saídas — um modelo único.
- **Entradas automáticas de venda:** todo pedido que fica `PAGO` vira receita no financeiro (sem digitação dupla).
- **Contas a pagar automáticas:** entrada de mercadoria (compra) gera uma conta a pagar ao fornecedor.
- **Fluxo de caixa consolidado** (previsto x realizado, por conta e por período).
- **Margem / lucro** por venda e por período (usa o `costCents` já capturado).
- **DRE gerencial** simples (receitas − despesas por categoria).

**Fora da Fase 2 (fases/futuro):**
- Conciliação bancária automática (importar OFX/extrato) e conciliação fina de taxas de cartão D+30.
- Crediário/"fiado" com limite e parcelas (entra se você marcar o fork §12.1).
- Emissão de boletos / cobrança recorrente.
- Rateio por centro de custo multi-loja.

---

## 2. Conceito central (poucas peças, muito reaproveitamento)

```
        Pedido PAGO (online/loja)              Entrada de compra (PURCHASE)
                 │  (receita)                          │ (despesa a pagar)
                 ▼                                      ▼
        ┌─────────────────────  FinancialEntry  ─────────────────────┐
        │  direction: INCOME | EXPENSE                               │
        │  status:    PENDING (previsto) | PAID (realizado) | CANCELED│
        │  amount, dueDate, paidDate, account, category, supplier?,   │
        │  orderId?, description                                       │
        └────────────────────────────┬───────────────────────────────┘
                                      │  (consultas derivadas)
        ┌──────────────┬──────────────┼──────────────┬───────────────┐
        ▼              ▼              ▼              ▼               ▼
   Contas a pagar  Contas a receber  Fluxo de caixa   DRE          Margem
   (EXPENSE,       (INCOME,          (status=PAID,    (por         (receita −
    PENDING)        PENDING)          por conta/data)  categoria)   custo/CMV)
```

**Um único modelo de lançamento** (`FinancialEntry`) descreve a pagar, a receber e
realizado — cada relatório é apenas um filtro. Isso é DRY: uma tabela, um serviço, um
padrão de tela reaproveitado (como já fazemos com `Order`/`StockMovement`).

> **Evitar duplicidade de dinheiro:** o caixa físico do PDV (`CashSession`/`CashMovement`)
> continua sendo a ferramenta do turno. A conta financeira **"Caixa"** representa o mesmo
> dinheiro — por isso o fechamento do caixa passa a **conferir** contra os lançamentos
> `PAID` da conta Caixa no período do turno (não cria um segundo saldo paralelo). Ver §4.

---

## 3. Modelo de dados (apenas modelos NOVOS — nada existente é renomeado/removido)

```prisma
model FinancialAccount {
  id        String  @id @default(cuid())
  name      String                  // "Caixa da loja", "Banco", "Mercado Pago"
  kind      String                  // CAIXA | BANCO | GATEWAY
  active    Boolean @default(true)
  entries   FinancialEntry[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model FinancialCategory {
  id        String  @id @default(cuid())
  name      String                  // "Vendas", "Fornecedores", "Aluguel"...
  type      String                  // INCOME | EXPENSE
  active    Boolean @default(true)
  entries   FinancialEntry[]
  @@unique([name, type])
}

model FinancialEntry {
  id          String   @id @default(cuid())
  direction   String                 // INCOME | EXPENSE
  status      String   @default("PENDING") // PENDING | PAID | CANCELED
  amountCents Int
  description String

  dueDate   DateTime?                // vencimento (competência p/ DRE)
  paidDate  DateTime?                // liquidação (regime de caixa p/ fluxo)

  accountId  String?                 // conta onde entrou/saiu (quando PAID)
  account    FinancialAccount?  @relation(fields: [accountId], references: [id], onDelete: SetNull)
  categoryId String?
  category   FinancialCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // vínculos de origem (reaproveitam entidades existentes — sem duplicar dados)
  orderId    String?                 // receita veio de um pedido
  supplierId String?                 // despesa é de um fornecedor
  createdById String?                // quem lançou (auditoria)

  // idempotência: 1 lançamento automático por origem (ex.: "order:<id>:income")
  sourceKey String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([direction, status])
  @@index([dueDate])
  @@index([paidDate])
  @@index([orderId])
}
```

Migração: **puramente aditiva** (novas tabelas) — `prisma db push`, mesmo fluxo da
Fase 1. Um seed idempotente cria as contas padrão (Caixa/Banco/Mercado Pago) e categorias
básicas (Vendas, Fornecedores, Despesas) se não existirem.

> Não adiciono relações reversas obrigatórias em `Order`/`Supplier` (guardo `orderId`/
> `supplierId` como campos soltos) para **não tocar** nos modelos críticos. As consultas
> usam esses ids diretamente.

---

## 4. Integração com o que já existe (reuso + idempotência, sem risco no núcleo)

| Gatilho existente | O que passa a acontecer | Cuidado |
|---|---|---|
| `updateOrderStatus(... "PAGO")` (webhook MP / manual) | cria `FinancialEntry` INCOME **PAID** (conta = Mercado Pago p/ ONLINE), `sourceKey="order:<id>:income"` | idempotente pelo `sourceKey` **e** pela guarda de status que já existe |
| `createStoreSale(...)` (PDV, nasce PAGO) | cria INCOME **PAID**: dinheiro→Caixa, pix→Banco, cartão→Banco/Cartão | mesmo `sourceKey`; roda **dentro** da transação da venda |
| `updateOrderStatus(... "REEMBOLSADO"/"CANCELADO")` | estorna: marca o lançamento de origem `CANCELED` (ou cria contrapartida) | reusa a guarda "só uma vez por pedido" já existente |
| `createStockEntry(...)` (compra) | se `costCents`>0, cria `FinancialEntry` EXPENSE **PENDING** (fornecedor, categoria Fornecedores) *(opcional — fork §12.2)* | idempotente por `sourceKey="stockentry:<id>"` |

**Princípio de segurança do núcleo:** o lançamento automático é criado **na mesma
transação** que já grava o `StockMovement`/o pedido (consistência atômica), espelhando
exatamente o padrão que o código já usa para movimentações de estoque. A guarda de
idempotência (`sourceKey` único + a guarda de toggle de status existente) impede
duplicação se o webhook reprocessar. **Nenhuma regra de estoque/pagamento é alterada** —
só se **acrescenta** um insert, como o `recordMovement` já faz.

Fechamento de caixa (PDV): `closeCashSession` passa a exibir, além do saldo contado, o
**esperado pela conta Caixa** (soma dos lançamentos `PAID` da conta Caixa no intervalo do
turno) — conferência, sem criar saldo paralelo.

---

## 5. Camada de serviço — `src/services/finance.ts` (novo)

Segue o padrão do projeto (funções puras + transação Prisma + `ApiError`):
- `recordEntry(tx?, {...})` — cria um lançamento (respeita `sourceKey` idempotente).
- `settleEntry(id, {accountId, paidDate})` — liquida uma conta a pagar/receber (PENDING→PAID).
- `cancelEntry(id)` — cancela (PENDING/PAID→CANCELED) com auditoria.
- `postSaleIncome(tx, order)` — helper chamado por `store-sale` e `orders` (regra de mapeamento conta↔pagamento num só lugar — DRY).
- `cashFlow({from, to, accountId?})` — entradas/saídas realizadas por dia/conta.
- `dre({from, to})` — receitas − despesas por categoria (competência).
- `profitability({from, to})` — receita de vendas − CMV (usa `OrderItem` + `costCents`).

O hook nos serviços críticos importa **um** helper (`postSaleIncome`) — a lógica mora no
serviço financeiro, os pontos de origem só o chamam (baixo acoplamento).

---

## 6. RBAC e navegação (já preparado na Fase 1)

- `finance.read` → ver telas/relatórios financeiros. `finance.write` → lançar/liquidar/cancelar.
- Sidebar: novo item **"Financeiro"** (perm `finance.read`) — já filtrado pela matriz.
- Páginas com `requirePagePermission("finance.read")`; ações de escrita nas rotas com `requirePermission("finance.write")`.

---

## 7. Telas — `/admin/financeiro`

Uma seção com abas (reaproveita `Modal`, tabelas admin, `RevenueChart`, `formatCurrency`):
1. **Visão geral** — saldo por conta, a pagar/receber do mês, entradas x saídas (gráfico).
2. **Contas a pagar** — lista (vencidas/a vencer), "marcar como paga", nova despesa.
3. **Contas a receber** — pendentes (fiado/cartão a compensar) *(se fork §12.1)*.
4. **Fluxo de caixa** — realizado por dia/conta, com filtro de período.
5. **DRE** — receitas − despesas por categoria + **margem/CMV** do período.
6. **Cadastros** — contas e categorias.

---

## 8. APIs (molde `handler` + Zod + `requirePermission` + `audit`)

| Rota | Método | Permissão |
|---|---|---|
| `/api/admin/finance/entries` | GET (filtros) / POST (novo lançamento) | read / write |
| `/api/admin/finance/entries/[id]` | PATCH (liquidar/editar) / DELETE (cancelar) | write |
| `/api/admin/finance/accounts` `[/id]` | CRUD | write |
| `/api/admin/finance/categories` `[/id]` | CRUD | write |
| `/api/admin/finance/reports/cashflow` | GET (CSV/JSON) | read |
| `/api/admin/finance/reports/dre` | GET | read |

Schemas Zod novos em `src/lib/validations.ts`: `financialEntrySchema`,
`financialEntrySettleSchema`, `financialAccountSchema`, `financialCategorySchema`.

---

## 9. Compatibilidade e não-regressão

- Só **novas tabelas** + **inserts adicionais** dentro de transações já existentes.
- Se o módulo financeiro estiver "desligado" (sem contas configuradas), os hooks são
  **no-op** — o e-commerce/PDV segue idêntico (mesmo princípio do tracking/e-mail).
- Idempotência via `sourceKey` único: reprocessar webhook **não** duplica receita.
- Núcleo (`orders`, `store-sale`, `stock`, `webhooks`, `cash`) só ganha uma chamada a
  `postSaleIncome`/`recordEntry` — regra de negócio existente intacta.

## 10. Critérios de aceite (como vou validar)

- [ ] Venda no PDV em dinheiro → entrada `PAID` na conta Caixa; pix/cartão → Banco.
- [ ] Pedido online PAGO (webhook) → entrada `PAID` na conta Mercado Pago, **sem duplicar** se o webhook repetir.
- [ ] Reembolso/cancelamento → lançamento de origem vira `CANCELED` (uma única vez).
- [ ] Entrada de compra → conta a pagar `PENDING` ao fornecedor *(se fork §12.2)*.
- [ ] "Marcar como paga" move `PENDING→PAID` e aparece no fluxo de caixa.
- [ ] Fluxo de caixa bate: saldo por conta = Σ entradas − Σ saídas `PAID`.
- [ ] DRE e margem do período conferem com pedidos/custos.
- [ ] FINANCEIRO e GERENTE acessam; CAIXA/ESTOQUISTA recebem 404/403.
- [ ] Fechamento de caixa mostra "esperado pela conta Caixa" e bate com o contado.
- [ ] `tsc --noEmit` limpo; e-commerce/PDV sem regressão.

---

## 11. Arquivos afetados (resumo)

**Novos:** `src/services/finance.ts`; `src/app/admin/financeiro/page.tsx` (+ componentes
`FinancePanel`/`PayableManager`/`CashFlowView`/`DreView`); rotas em
`src/app/api/admin/finance/*`; seed idempotente das contas/categorias padrão.

**Alterados (aditivo/seguro):** `prisma/schema.prisma` (3 modelos novos);
`src/lib/validations.ts` (schemas); `src/components/admin/AdminSidebar.tsx` (item Financeiro);
`src/services/store-sale.ts` e `src/services/orders.ts` (uma chamada a `postSaleIncome`);
`src/services/stock.ts` (uma chamada a `recordEntry` na compra — se fork §12.2);
`src/services/cash.ts` (conferência no fechamento).

**Não tocados na regra de negócio:** motor de baixa de estoque, webhook (só ganha o
insert idempotente), `lib/auth.ts`, RBAC.

---

## 12. Decisões que preciso de você (travam o design)

1. **Contas a receber (fiado/cartão a compensar)** — incluir já no MVP (crediário do
   cliente + cartão pendente de repasse), ou focar o MVP em **pagar + fluxo de caixa**
   (vendas pagas entram automáticas) e deixar "a receber" para uma sub-fase? *(recomendo
   deixar para depois: para loja com MP/PDV, quase tudo já entra como recebido.)*
2. **Compra → conta a pagar automática** — ao lançar entrada de mercadoria com custo,
   gerar automaticamente uma conta a pagar ao fornecedor (com vencimento a definir)?
   *(recomendo sim — fecha o ciclo estoque↔financeiro sem digitar duas vezes.)*
3. **Venda paga → lançamento automático** — lançar a receita no financeiro quando o
   pedido fica PAGO, mapeando dinheiro→Caixa, pix/cartão→Banco, online→Mercado Pago?
   *(recomendo sim — é o que dá fluxo de caixa e DRE reais.)*

---

## 13. Status da implementação (concluída e verificada)

Decisões travadas: **receita automática nas vendas pagas** + **compra gera conta a
pagar automática** + **contas a receber ficam para uma sub-fase**.

**Entregue:**
- Schema: `FinancialAccount`, `FinancialCategory`, `FinancialEntry` (aditivo, `db push`).
- `src/services/finance.ts`: `ensureFinanceDefaults`, `postSaleIncome`, `cancelSaleIncome`,
  `postPurchasePayable`, `createEntry`, `settleEntry`, `cancelEntry`, `accountBalances`,
  `cashFlow`, `dre`, `salesMargin`.
- Hooks (dentro das transações existentes, idempotentes por `sourceKey`):
  `store-sale.ts` (PDV→receita), `orders.ts` (PAGO→receita, CANCELADO/REEMBOLSADO→estorno),
  `stock.ts` (compra→conta a pagar).
- Schemas Zod + rotas `/api/admin/finance/{entries[/id],accounts,categories}`.
- Menu "Financeiro" (perm `finance.read`) + página `/admin/financeiro` + `FinancePanel`
  (Visão geral, Contas a pagar, Fluxo de caixa, DRE, Cadastros).
- Contas/categorias padrão no `seed.ts` (idempotente) e via `ensureFinanceDefaults` na
  primeira visita do módulo.

**Verificado no navegador (dev):**
- ✅ Despesa manual → conta a pagar → "marcar paga" (conta Banco) → saldo −R$1.200, sai no fluxo.
- ✅ Venda no PDV em **Pix** → receita `PAID` R$159,90 na conta **Banco** (mapeamento correto).
- ✅ Venda no PDV em **dinheiro** → receita na conta **Caixa** (mapeamento correto).
- ✅ Saldos, Entradas/Saídas do mês, Resultado de caixa e **Margem bruta** (vendas − CMV) reconciliam.
- ✅ `sourceKey` idempotente por pedido (`order:<id>:income`).
- ✅ `tsc --noEmit` limpo; sem erros no servidor; e-commerce/PDV sem regressão.
- RBAC: a página usa `requirePagePermission("finance.read")` e as rotas
  `requirePermission("finance.read"/"finance.write")` — mesmo mecanismo já provado na Fase 1
  (CAIXA/ESTOQUISTA não têm a permissão → 404/403).

**Observações:**
- CMV usa o custo ATUAL do produto/variação (aproximação). Snapshot de custo no
  `OrderItem` fica para uma evolução (melhora a precisão histórica da margem).
- Estorno de venda marca a receita como `CANCELED` (some do fluxo/DRE). Contrapartida
  explícita (despesa de reembolso) pode entrar junto com a sub-fase de "a receber".
