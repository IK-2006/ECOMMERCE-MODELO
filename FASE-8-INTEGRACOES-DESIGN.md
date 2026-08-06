# Fase 8 — Integrações (design + status)

> Sincronização com **marketplaces** (Mercado Livre/Shopee) exige apps OAuth do vendedor
> e não pode ser validada aqui. O entregável real desta fase é o **Centro de Integrações**:
> um painel que detecta e mostra o status de todas as integrações a partir da configuração.

## Escopo (decisões autônomas)
- **Centro de Integrações** (`/admin/integracoes`, perm `settings.manage`): status ao vivo
  de cada integração, reaproveitando os *config-checkers* que já existem.
- Marketplaces listados como **"Planejado"** (dependem de OAuth do vendedor).

## Implementação
- Página `src/app/admin/integracoes/page.tsx` + item de menu (perm `settings.manage`).
- Reaproveita `isMercadoPagoConfigured()`, `hasMelhorEnvioCredentials()`,
  `hasCorreiosCredentials()`, `isEmailConfigured()`, `isFiscalConfigured()` + checagem de env (Meta/WhatsApp).
- Mostra: nome, categoria, status (Conectado/Não configurado/Planejado), descrição e a env var.

## Verificado no navegador (dev)
- ✅ Página renderiza "0 de 9 conectadas" (nenhuma env em dev), com badges corretos.
- ✅ Marketplaces (ML/Shopee) como "Planejado". Gate `settings.manage` (só ADMIN). `tsc` limpo.

## O que falta para marketplaces IREM AO AR (fora do ambiente)
1. Criar **app de integração** no Mercado Livre / Shopee (client id/secret) e fluxo **OAuth** do vendedor.
2. Serviço de sincronização (anúncios ↔ produtos, estoque, pedidos) + webhooks do marketplace.
3. Mapeamento de categorias/atributos exigidos por cada marketplace.
