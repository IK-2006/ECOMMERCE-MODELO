# Fase 4 — Estoque avançado (design + status)

> A partir daqui as decisões de design são tomadas de forma autônoma (escolha KISS,
> reaproveitando o núcleo), conforme pedido. Documento de design **e** status.

## Escopo (decisões)
1. **Custo médio ponderado** na entrada de compra — em vez de sobrescrever o custo com o
   último valor, calcula `(estoque×custoAtual + qtd×custoNovo)/(estoque+qtd)`. Corrige a
   valorização do estoque. *(Decisão: adotar média ponderada — padrão ERP.)*
2. **Inventário / balanço** — contagem em lote que ajusta o estoque e registra a diferença
   como movimento `CORRECTION`. Reaproveita `recordMovement`. *(Decisão: painel de busca+contagem.)*
3. **Estoque mínimo (`minStock`) editável + alertas** — campo já existia no schema mas não
   era editável nem usado no dashboard. Agora é editável no produto e dirige os alertas de
   reposição (produtos **e** variações). *(Decisão: default 5 quando não definido, preservando o alerta histórico.)*
4. **Curva ABC** — adiada para a **Fase 7 (Relatórios)** para não duplicar a área de relatórios.

## Implementação
- `src/services/stock.ts`: `weightedAvgCost()` (usado em `createStockEntryTx`),
  `applyInventory()` (ajuste em lote → `CORRECTION`), `lowStockItems()` + `DEFAULT_MIN_STOCK`.
- `minStock`: `productSchema` (+campo), rotas de produto POST/PATCH, `ProductForm` (campo
  "Estoque mínimo") e mapeamento na página de edição.
- Nova rota `/api/admin/stock/inventory` (perm `stock.write`) + `InventorySchema`.
- `InventoryPanel.tsx` na tela de Estoque (ao lado de "Entrada de mercadoria").
- Dashboard: alerta de estoque baixo passou a usar `lowStockItems()` (variações + minStock).

## Verificado no navegador (dev)
- ✅ Entrada de 3 un. a R$70 sobre estoque 17 × R$50 → estoque 20, **custo R$ 53,00** (média exata).
- ✅ Inventário 20 → 18 → estoque 18 + movimento `CORRECTION` (delta −2, nota "Inventário / balanço").
- ✅ `minStock` salvo (20) pelo form; dashboard passou a alertar "11 items no estoque mínimo ou abaixo" (cobrindo variações).
- ✅ `tsc --noEmit` limpo; sem erros no servidor; entrada de compra/OC continua gerando conta a pagar.

## Observações
- Sem mudança de schema (o `minStock` já existia). A média ponderada altera o
  comportamento de custo do `createStockEntry` (antes sobrescrevia) — mudança deliberada e testada.
- O movimento de estoque continua registrando o custo da **transação** (`costCents` da entrada);
  o custo **médio** fica no produto/variação (base da valorização).
