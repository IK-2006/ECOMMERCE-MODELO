# Fase 6 — Fiscal (NFC-e / NF-e) — design + status

> **Fase de infraestrutura cabeada.** A emissão real depende de serviços/credenciais
> externos (provedor + certificado digital A1 + SEFAZ), que não podem ser validados
> neste ambiente. Entregue: serviço + adaptador de provedor + modelo + UI, operando em
> **modo "não configurado"** sem credenciais (registra a intenção, não transmite).

## Escopo (decisões autônomas)
- Reaproveitar o modelo `FiscalInvoice` (já existia no schema) — só faltava o serviço/UI.
- Emissão de **NFC-e** (balcão) e **NF-e** (envio) a partir do pedido pago.
- Adaptador de provedor **Focus NFe** (Basic auth por token; `ref` idempotente).
- Idempotência por `providerRef = order:<id>:<tipo>` — não reemite nota já autorizada/processando.
- Sem credenciais → registra a nota com status `ERRO` e orientação clara (não quebra nada).

## Implementação
- `src/lib/fiscal-config.ts`: lê env do provedor; `isFiscalConfigured()`.
- `src/services/fiscal.ts`: `emitFiscalInvoice({orderId,type})`, `invoicesForOrder()`,
  adaptador `emitViaFocusNFe()` (monta payload + `fetch` para a API — só roda se configurado).
- `fiscalEmitSchema` + rota `POST /api/admin/orders/[id]/fiscal` (perm `fiscal.manage`).
- `FiscalPanel.tsx` na página do pedido: lista notas (status/DANFE/XML/erro) + botões Emitir NFC-e/NF-e.

## Verificado no navegador (dev)
- ✅ Painel Fiscal aparece na página do pedido com aviso "não configurado".
- ✅ Emitir NFC-e → cria `FiscalInvoice` (status `ERRO`, `providerRef` idempotente) com a mensagem de orientação.
- ✅ Painel exibe a nota com status "Erro" e o motivo.
- ✅ RBAC: botões só para quem tem `fiscal.manage` (CAIXA/GERENTE/ADMIN). `tsc` limpo; sem erros.

## O que falta para IR AO AR (fora do ambiente)
1. **Conta no provedor** (Focus NFe/Nuvem Fiscal) + **certificado digital A1** enviado ao provedor.
2. **Env**: `FOCUS_NFE_TOKEN`, `STORE_CNPJ` (já existe), `FISCAL_ENVIRONMENT=homologacao|producao`,
   opcional `FISCAL_PROVIDER`, `FOCUS_NFE_URL`.
3. **Tributação por produto/operação**: CFOP, CST/CSOSN, ICMS/PIS/COFINS, IE da loja — completar
   o payload em `emitViaFocusNFe` (hoje mínimo). Normalmente derivado de um regime tributário configurável.
4. **Assíncrono**: o provedor autoriza de forma assíncrona; ligar o **webhook** do provedor
   (reaproveitar `WebhookEvent`) para atualizar `FiscalInvoice` de PROCESSANDO → AUTORIZADA.
5. Cancelamento / carta de correção (endpoints adicionais do provedor).

## Observação
- O núcleo (pedidos/estoque/financeiro) não é tocado; a emissão é aditiva e idempotente.
