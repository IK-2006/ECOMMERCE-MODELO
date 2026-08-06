# Fase 9 — BI (Painel executivo) — design + status

## Escopo (decisões autônomas)
- Painel executivo `/admin/bi` (perm `reports.read`) que **consolida** os módulos anteriores.
- Comparativo **mês atual vs. mês anterior** (faturamento, pedidos, ticket médio, lucro bruto).
- **Meta** de faturamento (barra de progresso; env `MONTHLY_REVENUE_GOAL_CENTS`, padrão R$10k).
- **DRE visual** (barras receita/despesa/resultado), **saldo em contas**, **top produtos (ABC classe A)**,
  tendência diária e alerta de estoque.

## Implementação
- Página `src/app/admin/bi/page.tsx` + item de menu "BI" (perm `reports.read`).
- **Reaproveita 100%**: `finance.dre/salesMargin/accountBalances`, `reports.abcCurve`,
  `stock.lowStockItems`, componente `RevenueChart`. Nenhum modelo/serviço novo.

## Verificado no navegador (dev)
- ✅ KPIs com delta mês a mês (ex.: faturamento ▼74,5%).
- ✅ Meta 12,3% de R$10k (barra); gráfico diário; saldo consolidado por conta.
- ✅ DRE visual (receitas/despesas/resultado) + Top produtos classe A + alerta de estoque.
- ✅ `tsc --noEmit` limpo; sem erros no servidor.

## Observação
- É a "camada de cima": não tem dados próprios, só agrega os módulos ERP entregues (F2/F4/F7).
