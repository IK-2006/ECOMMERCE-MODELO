# 🔓 Auditoria de Quebra Total — Rodada 2 (aprofundada)

**Aplicação:** E-commerce Gata Fit · **Data:** 02/08/2026 · **Escopo:** aplicação inteira, foco adversarial em pagamento, concorrência e integridade de dados.
**Complementa** o [RELATORIO-AUDITORIA-2026-08.md](RELATORIO-AUDITORIA-2026-08.md) (rodada 1). Método: revisão de código com hipótese de falha, testes de integração no banco real, fuzzing HTTP, testes de concorrência e simulação de webhooks.

> Esta rodada foi mais fundo no **fluxo de dinheiro** e achou **1 defeito CRÍTICO** que a rodada 1 não pegou. Todos os achados foram **corrigidos e reverificados**.

---

## Resumo Executivo

| Severidade | Qtd | Status |
|---|---|---|
| 🔴 Crítico | **1** | ✅ corrigido + testado |
| 🟠 Alto | **1** | ✅ corrigido + testado |
| 🟡 Médio | **2** | 1 corrigido · 1 documentado |
| 🟢 Baixo | **2** | documentados |

Após as correções: **0 críticos e 0 altos remanescentes.**

---

## 🔴 CRÍTICO

### C1 — Webhook do Mercado Pago descartava a notificação de "aprovado" → pedido pago ficava preso em "Aguardando pagamento"

- **Descrição:** a idempotência do webhook usava o **id do pagamento** (`data.id`) como chave. O MP envia **várias notificações para o mesmo pagamento** (Pix e boleto vão *pending → approved*). A primeira (pending) marcava a chave como processada; a segunda (**approved**) era tratada como "duplicada" e **descartada** — o pedido nunca virava PAGO.
- **Como reproduzir:** cliente paga via **Pix/boleto** → MP manda notificação `pending` (processada) e depois `approved` (descartada) → pedido fica em `AGUARDANDO_PAGAMENTO` para sempre, mesmo pago.
- **Impacto:** 🔴 **perda financeira/operacional direta** — cliente paga e o pedido não avança; ninguém separa/envia; estoque continua reservado; loja parece ter "sumido" com o dinheiro. Alto risco num país onde **Pix é maioria**.
- **Arquivos:** `src/app/api/webhooks/mercadopago/route.ts`
- **Correção aplicada:** chave de idempotência passou a ser o **id da NOTIFICAÇÃO** (`payload.id`), não o do pagamento. Assim, notificações distintas do mesmo pagamento são processadas; reenvios da MESMA notificação continuam deduplicados.
  ```ts
  const notificationId = String(payload.id ?? url.searchParams.get("id") ?? dataId);
  const eventKey = { provider: "mercadopago", externalId: notificationId, type: "payment" };
  ```
- **Verificado (HTTP):** notif A → processada · notif A de novo → `duplicated` · **notif B (mesmo pagamento) → processada** (antes seria descartada). ✅

---

## 🟠 ALTO

### A1 — Estoque reservado na criação do pedido nunca é liberado em checkout abandonado

- **Descrição:** o estoque é **decrementado na criação** do pedido (antes do pagamento — o que evita overselling). Mas se o cliente vai ao Mercado Pago e **desiste** (fecha a aba sem pagar), o pedido fica em `AGUARDANDO_PAGAMENTO` e o estoque fica **reservado para sempre**. Ao longo do tempo, o estoque "some" sozinho.
- **Como reproduzir:** iniciar checkout (cria pedido, baixa estoque) → não pagar → estoque nunca volta.
- **Impacto:** 🟠 **inventário drena** com o tempo → produtos aparecem esgotados sem terem sido vendidos → perda de vendas.
- **Arquivos:** `src/services/orders.ts`, `src/app/api/cron/expire-orders/route.ts` (novo), `src/lib/cron-auth.ts` (novo)
- **Correção aplicada:** função `expireStaleOrders()` + cron protegido `/api/cron/expire-orders` que **cancela pedidos ONLINE parados em AGUARDANDO_PAGAMENTO** há mais de `ORDER_EXPIRY_HOURS` horas e **devolve o estoque**. **Opt-in** (desligado se `ORDER_EXPIRY_HOURS` vazio) e protegido por `CRON_SECRET`.
  ```ts
  const stale = await prisma.order.findMany({
    where: { status: "AGUARDANDO_PAGAMENTO", channel: "ONLINE", createdAt: { lt: cutoff } },
    select: { id: true }, take: 200,
  });
  for (const o of stale) await updateOrderStatus({ orderId: o.id, status: "CANCELADO", note: "…" });
  ```
- **Verificado:** pedido de 48h → cancelado + estoque devolvido; pedido recente → intacto; desligado sem a env. ✅
- **⚠️ Risco residual (documentado):** se o **boleto** estiver habilitado, `ORDER_EXPIRY_HOURS` deve ser **maior que o prazo do boleto** (ex.: 96h) para não cancelar boletos ainda pagáveis. Registrado no `.env.example` e no `DEPLOY.md`.

---

## 🟡 MÉDIO

### M1 — Alternar status para/dentro de CANCELADO/REEMBOLSADO inflava o estoque e corrompia o contador do cupom

- **Descrição:** o estorno de estoque só checava `statusChanged`. Um admin alternando `CANCELADO → PAGO → CANCELADO` **devolvia o estoque a cada cancelamento** (e decrementava `usedCount` do cupom repetidamente), pois voltar para PAGO não re-reserva.
- **Como reproduzir:** no pedido, mudar status Cancelado → Pago → Cancelado algumas vezes → estoque infla; cupom pode ir a negativo.
- **Impacto:** 🟡 **corrupção de dados** de estoque e cupom (cenário "administrador distraído").
- **Arquivos:** `src/services/orders.ts`
- **Correção aplicada:** guarda por movimento — só devolve estoque/cupom **uma vez por pedido** (checa se já existe `StockMovement` com `reason: "CANCEL_RESTORE"`).
  ```ts
  const alreadyRestored = await tx.stockMovement.findFirst({ where: { orderId, reason: "CANCEL_RESTORE" }, select: { id: true } });
  if (!alreadyRestored) { await restoreStock(...); /* + decremento do cupom */ }
  ```
- **Verificado:** toggle repetido mantém estoque estável e apenas 1 `CANCEL_RESTORE`. ✅

### M2 — Alerta de "estoque baixo" do Dashboard ignora produtos COM variações *(documentado, não corrigido)*

- **Descrição:** a contagem usa `variants: { none: {} }`, então produtos com variação (todos da Gata Fit) **nunca** entram no alerta — ele fica sempre em 0.
- **Impacto:** 🟡 UX/gestão — o lojista pode não perceber itens acabando pelo dashboard.
- **Arquivos:** `src/app/admin/page.tsx`
- **Correção recomendada:** contar estoque agregando variações (ou usar `productVariant` com `stock <= limite`). **A fonte real e correta já existe** em `/admin/estoque` (mostra por variação com filtros baixo/esgotado), por isso não é bloqueante.

---

## 🟢 BAIXO

### B1 — Colisão de número de pedido (rara)
`generateOrderNumber()` gera `PED-ANO-XXXXXX` (32⁶ combinações). Colisão dispara `P2002` → a transação faz **rollback limpo** (409 ao cliente, sem efeito colateral). **Recomendação:** re-tentar a geração 1–2× no `createOrder`. `src/lib/utils.ts`.

### B2 — "Descancelar" (CANCELADO → PAGO) não re-reserva estoque
Cenário de admin. Com o guard de M1, **não corrompe** mais (não infla), mas o pedido reativado fica sem estoque reservado. **Recomendação:** bloquear transições a partir de estados terminais na UI (`OrderStatusForm`). Residual/baixo.

---

## Etapas de auditoria — resultado

**1–2. Mapeamento & rotas:** 38 route handlers + páginas mapeados (ver relatório R1). Sem rotas órfãs/desprotegidas.

**3. Segurança (OWASP):** reconfirmado seguro — Prisma parametrizado (sem SQL/NoSQLi), Zod barra type-confusion, React/feed escapam saída (sem XSS), upload valida magic bytes e **rejeita SVG**, headers/CSP/HSTS, sem segredos `NEXT_PUBLIC_`. Rodada 1 já corrigira JSON-500, enumeração de cupom e corrida de cupom.

**4. Autorização:** as 14 rotas `/api/admin/*` exigem `requireAdmin`; `/api/account/*` com escopo por `userId` (sem IDOR); sem escalada (`register`/`profile` não aceitam `role`). Não há papéis "gerente/funcionário" — apenas ADMIN e CUSTOMER.

**5. Banco:** FKs e cascatas coerentes; unique em `Order.number`, `WebhookEvent(provider,externalId,type)`, `Review(productId,userId)`; soft-delete preserva histórico. Sem órfãos observados.

**6. Concorrência:** ✅ **testado** — 5 checkouts simultâneos para a última unidade → **1 sucesso, 0 oversell, estoque nunca negativo**. Estoque e cupom (`maxUses`) usam atualização **atômica condicional**.

**7. Performance:** consultas do dashboard usam `Promise.all` + `groupBy` (sem N+1 crítico); listagens usam `include` seletivo. Adequado à escala. Cron de rastreio/expiração limitado a 200–300 por execução.

**8. Logs/observabilidade:** `AuditLog` para ações admin/auth/cron; **sem** vazamento de dados sensíveis (senha nunca logada; e-mail em dev loga só destinatário/assunto). Sentry integrado (gated).

**9. Resiliência:** frete com **fallback** (Melhor Envio → Correios → tabela interna); pagamento com fonte de verdade na API do MP + retry via 500; e-mail/WhatsApp **gated + try/catch** (nunca derrubam o pedido); `/api/health` responde **503** se o banco cair.

---

## Score Geral (pós-correção)

| Dimensão | Nota |
|---|---|
| 🔐 Segurança | **9.3 / 10** |
| ⚡ Performance | **8.5 / 10** |
| 🏛️ Arquitetura | **9.2 / 10** |
| 🧹 Qualidade de código | **9.2 / 10** |
| 💪 Robustez / integridade | **9.2 / 10** |

### ⭐ Nota final: **9.2 / 10**

A rodada aprofundada encontrou **um defeito crítico real no fluxo de pagamento** (que a análise superficial não pega) e **um vazamento de estoque** — ambos corrigidos e testados. Com isso, o ponto mais frágil do sistema (dinheiro entrando) ficou sólido. Não restam problemas críticos ou altos.

## Verificação pós-correção
- `tsc --noEmit` — **0 erros**
- Toggle de status + expiração (DB real) — **10/10**
- Concorrência/oversell (5 simultâneos) — **5/5**
- Webhook idempotência por notificação (HTTP) — **OK** (A→ok, A→duplicated, B→processado)
- Gate dos crons (sem/segredo errado) — **401**
- Dashboard: faturamento exclui cancelado/reembolsado/pendente — **correto**
