# Fase 3 — Desenho técnico: Compras (Ordem de Compra)

> **Documento de design. Nenhum código de produção será escrito até este desenho ser
> validado.** Objetivo: adicionar o fluxo formal de **Ordem de Compra** (rascunho →
> enviada → recebimento parcial/total), **reaproveitando** o motor de entrada de estoque
> (`createStockEntry`) e a **conta a pagar automática** (Fase 2). Fecha o ciclo
> compras → estoque → financeiro sem digitar nada duas vezes.

Pré-requisitos já prontos: RBAC `purchases.read` / `purchases.write` (Fase 1 — GERENTE e
ESTOQUISTA já têm), `Supplier`, `createStockEntry` (movimenta estoque + custo), e o hook
de conta a pagar no recebimento (Fase 2).

---

## 1. Escopo

**Dentro da Fase 3:**
- **Ordem de Compra (OC)**: cabeçalho + itens (produto/variação, quantidade, custo unitário).
- Ciclo de status: `RASCUNHO` → `ENVIADA` → `RECEBIDA_PARCIAL` → `RECEBIDA` / `CANCELADA`.
- **Recebimento** (total ou parcial — fork §11.1): dá entrada no estoque **reaproveitando
  `createStockEntry`** e gera a **conta a pagar** (Fase 2) da mercadoria recebida.
- Custo do recebimento **editável** (a nota do fornecedor pode divergir da OC).
- Tela de Compras: lista, nova OC, detalhe com recebimento.
- Numeração `OC-2026-000123` e auditoria de todas as ações.

**Fora da Fase 3:**
- Cotação com múltiplos fornecedores / comparação de propostas.
- Aprovação com alçadas (limites por valor/usuário) — pode entrar depois.
- Importação de XML da NF-e de compra (entra junto da Fase 6 Fiscal).

---

## 2. Conceito e reaproveitamento

```
   Nova OC (RASCUNHO)         Enviar ao fornecedor        Receber (total/parcial)
   itens + custo esperado  →       (ENVIADA)         →     dá entrada no estoque
                                                            + gera conta a pagar
                                                            + atualiza custo do produto
                                   status: RECEBIDA_PARCIAL / RECEBIDA
                                            │
                                            ▼  (reaproveita 100%)
                                   createStockEntry(...)  ← Fase 1/2 já existe:
                                     • soma estoque (movimento PURCHASE)
                                     • atualiza costCents do produto/variação
                                     • postPurchasePayable → conta a pagar (Fase 2)
```

O recebimento **não reimplementa** nada de estoque/financeiro: monta os itens recebidos e
chama `createStockEntry`, que já faz a baixa/entrada atômica, o custo e a conta a pagar.
A OC só acrescenta o **workflow** por cima (o que foi pedido × o que já chegou).

---

## 3. Modelo de dados (apenas modelos NOVOS — nada existente é alterado)

Seguindo o padrão da Fase 2, guardo `supplierId`/`createdById` como campos soltos (sem
relação reversa) para **não tocar** em `Supplier`/`User`.

```prisma
model PurchaseOrder {
  id          String   @id @default(cuid())
  number      String   @unique            // OC-2026-000123
  supplierId  String?                     // fornecedor (nome resolvido por lookup)
  // RASCUNHO | ENVIADA | RECEBIDA_PARCIAL | RECEBIDA | CANCELADA
  status      String   @default("RASCUNHO")
  notes       String?
  expectedAt  DateTime?                    // previsão de entrega
  totalCents  Int      @default(0)         // soma esperada (Σ qtd × custo)
  createdById String?
  items       PurchaseOrderItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
  @@index([supplierId])
}

model PurchaseOrderItem {
  id              String  @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  productId       String
  variantId       String?
  name            String                   // snapshot legível
  quantity        Int                      // quantidade pedida
  receivedQty     Int     @default(0)      // recebido acumulado (parcial)
  unitCostCents   Int                      // custo unitário esperado

  @@index([purchaseOrderId])
}
```

Migração: puramente aditiva (`prisma db push`), mesmo fluxo das fases 1 e 2.

---

## 4. Serviço — `src/services/purchases.ts` (novo)

Padrão do projeto (transação + `ApiError` + reuso):
- `createPurchaseOrder({ supplierId, items, notes, expectedAt, adminId })` — cria a OC em `RASCUNHO`, calcula `totalCents`.
- `updatePurchaseOrder(...)` / `sendPurchaseOrder(id)` (RASCUNHO→ENVIADA) / `cancelPurchaseOrder(id)`.
- `receivePurchaseOrder({ id, adminId, lines: [{ itemId, qty, unitCostCents? }] })`:
  1. valida (não receber mais que o pendente por item);
  2. monta os itens recebidos e chama **`createStockEntry`** (estoque + custo + conta a pagar);
  3. incrementa `receivedQty` de cada item;
  4. recalcula o status (`RECEBIDA` se tudo chegou, senão `RECEBIDA_PARCIAL`);
  5. tudo numa transação, com auditoria.

> O custo do recebimento usa `unitCostCents` da OC por padrão, mas cada linha pode
> sobrescrever (nota real do fornecedor). Esse custo é o que vai para o estoque/financeiro.

---

## 5. RBAC e navegação (já preparado)

- `purchases.read` → ver OCs. `purchases.write` → criar/enviar/receber/cancelar.
- Novo item de menu **"Compras"** (perm `purchases.read`) — GERENTE, ESTOQUISTA, ADMIN.
- Página com `requirePagePermission("purchases.read")`; ações nas rotas com `requirePermission("purchases.write")`.

---

## 6. Telas — `/admin/compras`

- **Lista**: OCs com fornecedor, status (badge), total e previsão; filtro por status.
- **Nova OC**: fornecedor, previsão, itens (busca de produto/variação + qtd + custo), total ao vivo.
- **Detalhe**: dados + itens (pedido × recebido × pendente); botões conforme status
  (Enviar, Receber, Cancelar). O **Receber** abre um painel com as quantidades pendentes
  e o custo (editável) → confirma → dá entrada e gera a conta a pagar.

Reaproveita `Modal`, tabelas admin, `Badge`, `formatCurrency`, e o padrão de busca de
produto do PDV/entrada de estoque.

---

## 7. APIs (molde `handler` + Zod + `requirePermission` + `audit`)

| Rota | Método | Permissão |
|---|---|---|
| `/api/admin/purchases` | GET (lista) / POST (nova OC) | read / write |
| `/api/admin/purchases/[id]` | GET / PATCH (editar/enviar/cancelar) | read / write |
| `/api/admin/purchases/[id]/receive` | POST (recebimento total/parcial) | write |

Schemas Zod novos: `purchaseOrderSchema`, `purchaseOrderUpdateSchema`, `purchaseReceiveSchema`.

---

## 8. Compatibilidade e não-regressão

- Só **novas tabelas** + **novo serviço**; o `createStockEntry` e a conta a pagar são
  **chamados**, não alterados.
- A **entrada direta de estoque atual** (tela Estoque) continua existindo (fork §11.2).
- Núcleo (estoque/pedidos/webhook/financeiro) intacto.

## 9. Critérios de aceite

- [ ] Criar OC em rascunho, enviar, e receber (total) → estoque sobe, custo atualiza, conta a pagar criada.
- [ ] Recebimento **parcial** → status `RECEBIDA_PARCIAL`, pendente correto; 2º recebimento fecha em `RECEBIDA` (fork §11.1).
- [ ] Custo editado no recebimento é o que vai para estoque/financeiro.
- [ ] Não é possível receber mais que o pendente.
- [ ] Cancelar OC não mexe em estoque já recebido.
- [ ] GERENTE/ESTOQUISTA acessam; CAIXA/FINANCEIRO recebem 404/403.
- [ ] Auditoria de criar/enviar/receber/cancelar; `tsc` limpo; sem regressão.

## 10. Arquivos afetados

**Novos:** `src/services/purchases.ts`; `src/app/admin/compras/{page.tsx, [id]/page.tsx}`
(+ componentes `PurchaseOrderForm`/`ReceivePanel`); rotas `src/app/api/admin/purchases/*`.
**Alterados (aditivo):** `prisma/schema.prisma` (2 modelos); `src/lib/validations.ts`
(schemas); `src/components/admin/AdminSidebar.tsx` (item Compras).
**Não tocados na regra de negócio:** `services/stock.ts` (só é chamado), financeiro, RBAC.

---

## 11. Decisões que preciso de você (travam o design)

1. **Recebimento parcial** — permitir receber a OC em partes (controlando pedido ×
   recebido × pendente por item), ou apenas **recebimento total** de uma vez? *(recomendo
   parcial: é o comportamento de ERP e casa com fornecedor que entrega faturado/fracionado.)*
2. **Entrada direta de estoque** — manter a entrada de mercadoria atual (tela Estoque)
   **em paralelo** à OC (para ajustes/estoque inicial/compras rápidas), ou passar a exigir
   que **toda** entrada venha de uma OC? *(recomendo manter as duas: a direta serve para
   ad-hoc; a OC é o fluxo formal — sem remover nada.)*

---

## 12. Status da implementação (concluída e verificada)

Decisões travadas: **recebimento parcial + total** + **manter a entrada direta em paralelo**.

**Entregue:**
- Schema: `PurchaseOrder` + `PurchaseOrderItem` (aditivo, `db push`).
- `src/services/stock.ts`: refatorado para expor `createStockEntryTx(tx, params)`
  (componível) — `createStockEntry` continua idêntico (wrapper). **Sem mudança de comportamento.**
- `src/services/purchases.ts`: `createPurchaseOrder`, `sendPurchaseOrder`,
  `cancelPurchaseOrder`, `receivePurchaseOrder` (recebimento reaproveita `createStockEntryTx`
  na mesma transação → estoque + custo + conta a pagar).
- Schemas Zod + rotas `/api/admin/purchases`, `/[id]` (send/cancel), `/[id]/receive`.
- Menu "Compras" (perm `purchases.read`) + páginas `/admin/compras`, `/nova`, `/[id]` +
  componentes `PurchaseOrderForm` e `PurchaseOrderActions` (recebimento parcial/total, custo editável).

**Verificado no navegador (dev):**
- ✅ Criar OC (rascunho, R$ 500) → enviar → status ENVIADA.
- ✅ Recebimento **parcial** (5/10) → status RECEBIDA_PARCIAL; estoque +5; movimento PURCHASE
  ("Recebimento OC …"); conta a pagar R$ 250.
- ✅ Recebimento do restante (5) → status RECEBIDA; estoque final **17** (7+5+5);
  **2 movimentos PURCHASE** e **2 contas a pagar de R$ 250** (uma por recebimento).
- ✅ Custo atualizado no produto/variação; sem transação aninhada; `tsc` limpo; sem erros no servidor.
- RBAC: mesmo mecanismo das fases 1/2 (`requirePagePermission("purchases.read")` +
  `requirePermission("purchases.write")`); GERENTE/ESTOQUISTA acessam, CAIXA/FINANCEIRO não.

**Observações:**
- A descrição da conta a pagar gerada é a genérica do `createStockEntry` ("Compra —
  entrada de mercadoria (N itens)"); a referência à OC fica na **nota do movimento de estoque**
  ("Recebimento OC …"). Vincular o `orderId` da OC no lançamento é uma melhoria simples futura.
- Edição de itens de uma OC em rascunho não está no MVP (criar nova/cancelar cobre o caso).
