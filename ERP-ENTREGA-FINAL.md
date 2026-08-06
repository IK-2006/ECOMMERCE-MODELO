# Entrega final — Evolução E-commerce → ERP

Roadmap **completo (9/9 fases)**, implementado um módulo por vez, cada um verificado no
navegador e com `tsc` limpo. **Build de produção passa** (`✓ Compiled successfully`, exit 0).
Nada foi commitado (fica no working tree para você revisar).

| Fase | Módulo | Status | Doc |
|---|---|---|---|
| — | Análise + comparação + roadmap | ✅ | [PLANO-EVOLUCAO-ERP.md](PLANO-EVOLUCAO-ERP.md) |
| 1 | RBAC + Gestão de Usuários | ✅ produção | [FASE-1-RBAC-DESIGN.md](FASE-1-RBAC-DESIGN.md) |
| 2 | Financeiro (a pagar, fluxo de caixa, DRE, margem) | ✅ produção | [FASE-2-FINANCEIRO-DESIGN.md](FASE-2-FINANCEIRO-DESIGN.md) |
| 3 | Compras (Ordem de Compra) | ✅ produção | [FASE-3-COMPRAS-DESIGN.md](FASE-3-COMPRAS-DESIGN.md) |
| 4 | Estoque avançado (custo médio, inventário, minStock) | ✅ produção | [FASE-4-ESTOQUE-DESIGN.md](FASE-4-ESTOQUE-DESIGN.md) |
| 5 | CRM (360, tags/segmentação, notas) | ✅ produção | [FASE-5-CRM-DESIGN.md](FASE-5-CRM-DESIGN.md) |
| 6 | Fiscal NFC-e/NF-e | 🟡 scaffolding | [FASE-6-FISCAL-DESIGN.md](FASE-6-FISCAL-DESIGN.md) |
| 7 | Relatórios (curva ABC, exports CSV) | ✅ produção | [FASE-7-RELATORIOS-DESIGN.md](FASE-7-RELATORIOS-DESIGN.md) |
| 8 | Integrações (centro de status) | 🟡 marketplaces planejados | [FASE-8-INTEGRACOES-DESIGN.md](FASE-8-INTEGRACOES-DESIGN.md) |
| 9 | BI (painel executivo) | ✅ produção | [FASE-9-BI-DESIGN.md](FASE-9-BI-DESIGN.md) |

## Princípios seguidos
- **Reaproveitamento máximo, sem duplicar**: o motor de estoque (`StockMovement`),
  o de pedidos, o caixa do PDV e o padrão de serviço/rota foram reutilizados em todas as fases.
- **Núcleo transacional intocado**: pedidos/estoque/webhook só ganharam *inserts* aditivos
  e idempotentes (mesmo padrão do `recordMovement`). Nenhuma regra de negócio existente foi alterada
  (exceção deliberada e testada: custo passou a ser **médio ponderado** na entrada — F4).
- **Migrações aditivas**: 8 modelos novos (`FinancialAccount/Category/Entry`, `PurchaseOrder(+Item)`,
  `CustomerProfile`) + colunas `User.active` e uso de `Product.minStock`. Nada renomeado/removido.
- **RBAC em tudo**: cada tela/rota nova é protegida por permissão desde a Fase 1.

## O que precisa de terceiros para "ir ao ar"
- **Fiscal (F6)**: conta no provedor (Focus NFe) + certificado A1 + tributação por produto
  (CFOP/CST/ICMS) + webhook do provedor. O código está cabeado; só transmite com credenciais.
- **Marketplaces (F8)**: apps OAuth do vendedor (Mercado Livre/Shopee) + serviço de sync + webhooks.

## Estado do ambiente (dev)
- Logins: `admin@loja.com` / `admin123`; teste CAIXA `maria.caixa@loja.com` / `caixa12345`.
- Dados de teste no `dev.db` (OCs, lançamentos, tags) somem no próximo `db:seed`.
- Novos menus: BI, Compras, Financeiro, Integrações, Usuários (filtrados por permissão).
