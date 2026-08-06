# Fase 5 — CRM (design + status)

## Escopo (decisões autônomas)
1. **Visão 360 do cliente** — a tela de detalhe já tinha pedidos, total gasto, avaliações,
   histórico e endereços. Acrescentado **ticket médio** e **última compra**.
2. **Tags / segmentação + notas** — anotações de CRM por cliente, sem tocar em `User`
   (modelo `CustomerProfile` com `userId` único). Tags separadas por vírgula, normalizadas
   em minúsculas. *(Decisão: modelo separado, não mexer no User de auth.)*
3. **Filtro por tag** na lista de clientes + chips de tag por linha.
4. **Crédito/fiado** — **adiado** (depende do motor de "a receber", que foi adiado na F2).

## Implementação
- Schema: `CustomerProfile { userId @unique, tags, notes }` (aditivo, `db push`).
- Permissão nova `customers.write` (GERENTE/ADMIN editam; CAIXA/FINANCEIRO veem read-only).
- `customerProfileSchema` + rota `PATCH /api/admin/customers/[id]` (upsert do perfil, auditado).
- `CustomerCrmPanel.tsx` (tags + notas; read-only para quem não tem `customers.write`).
- Página de detalhe: métricas (ticket médio, última compra) + painel CRM.
- Lista de clientes: filtro `?tag=` + exibição de chips de tag.

## Verificado no navegador (dev)
- ✅ Salvar tags "VIP, Atacado" + nota → persistido como `vip,atacado` (normalizado).
- ✅ Filtro `?tag=vip` → retorna só o cliente marcado, com chips VIP/ATACADO.
- ✅ Métricas de ticket médio e última compra na ficha do cliente.
- ✅ `tsc --noEmit` limpo; sem erros no servidor.

## Observações
- Edição de CRM exige `customers.write`; a ficha é read-only para papéis com só `customers.read`.
- Crédito/fiado entra junto da sub-fase de "contas a receber" (F2 estendida), quando priorizado.
