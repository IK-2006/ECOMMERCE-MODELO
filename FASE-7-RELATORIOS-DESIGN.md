# Fase 7 — Relatórios (design + status)

## Escopo (decisões autônomas)
- **Curva ABC** (adiada da F4): produtos por contribuição no faturamento (Pareto A/B/C).
- **Exportações CSV** reaproveitando o padrão do relatório de vendas (`;` + BOM UTF-8):
  vendas (já existia), **financeiro** (lançamentos) e **estoque** (posição + valorização).
- `services/reports.ts` como camada reutilizável de agregação/CSV.

## Implementação
- `src/services/reports.ts`: `abcCurve()`, `stockValuationCsv()`, `financeEntriesCsv()` + helpers CSV.
- Rotas `GET /api/admin/reports/stock` e `/api/admin/reports/finance` (perm `reports.read`).
- `ReportDownload` generalizado (prop `endpoint`) → reusado para vendas e financeiro.
- Página `/admin/relatorios`: seções de export (vendas/financeiro/estoque) + tabela da Curva ABC (90 dias).

## Verificado no navegador (dev)
- ✅ Curva ABC renderiza com classe A/B/C e % acumulado (Pareto correto).
- ✅ CSV de estoque: 200, cabeçalho `Produto;Variação;SKU;Estoque;Custo;Valor em estoque`, 284 linhas.
- ✅ CSV financeiro: 200, cabeçalho `Data;Tipo;Status;Descrição;Categoria;Conta;Valor;Vencimento;Pago em`.
- ✅ `tsc --noEmit` limpo; sem erros no servidor.

## Observação
- Relatórios reaproveitam `finance.cashFlow/dre` (F2) e o `StockMovement`/custo (F4). PDF via impressão do navegador.
