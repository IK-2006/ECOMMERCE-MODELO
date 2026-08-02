# 📦 Integração Melhor Envio — Geração de Etiquetas & Rastreio

Relatório técnico e operacional da integração que permite ao lojista **gerar
etiquetas de envio direto pelo painel**, imprimir, postar e ter o cliente
**notificado automaticamente** (e-mail + WhatsApp) a cada etapa, com
**rastreio sincronizado** sem digitação manual.

> **Resumo em uma frase:** pedido pago → lojista separa → clica **Gerar
> etiqueta** → o sistema cria a etiqueta no Melhor Envio, salva rastreio + PDF,
> marca o pedido como **Enviado** e avisa o cliente; um cron confirma a
> **entrega** depois.

---

## 1. Como funciona (visão geral)

```
Pedido PAGO
   │
   ▼
[Admin] abre o pedido → painel "Envio / Etiqueta" → clica "Gerar etiqueta"
   │
   ▼
POST /api/admin/orders/[id]/label   (somente admin, com auditoria)
   │
   ├─ 1. Melhor Envio: adiciona ao carrinho      (/me/cart)
   ├─ 2. Melhor Envio: checkout — paga com SALDO  (/me/shipment/checkout)
   ├─ 3. Melhor Envio: gera a etiqueta            (/me/shipment/generate)
   ├─ 4. Melhor Envio: PDF para impressão         (/me/shipment/print)
   └─ 5. Melhor Envio: código de rastreio         (/me/shipment/tracking)
   │
   ▼
Salva no pedido: rastreio, transportadora, PDF, protocolo, status do envio
   │
   ▼
Pedido → status ENVIADO  →  dispara e-mail + WhatsApp "Pedido enviado"
   │
   ▼
[Cron] GET /api/cron/tracking (de tempos em tempos) atualiza o rastreio;
       ao acusar entrega, marca ENTREGUE → e-mail + WhatsApp "Pedido entregue"
```

A **embalagem é sempre responsabilidade da loja** — a etiqueta cobre apenas o
transporte. O lojista imprime a etiqueta, embala, cola e posta na agência.

---

## 2. Autenticação: por que dois tokens?

O Melhor Envio separa permissões por escopo:

| Operação | Token usado | Escopo |
|---|---|---|
| **Cotar** frete (checkout da loja) | `client_credentials` (Client ID+Secret) — gerado e renovado sozinho | `shipping-calculate` |
| **Gerar etiqueta** (cart→checkout→generate→print→tracking) | **`MELHOR_ENVIO_TOKEN`** — token **pessoal** da conta | `shipping-cart`, `shipping-checkout`, `shipping-generate`, `shipping-print`, `shipping-tracking` |

Sem o `MELHOR_ENVIO_TOKEN`, o botão **Gerar etiqueta** responde com uma
mensagem clara pedindo para configurá-lo (o `client_credentials` **não tem**
permissão de etiqueta). Quando o token pessoal está presente, ele é usado
também na cotação.

### Como gerar o token pessoal (uma vez)
1. Acesse **melhorenvio.com.br → Painel → Integrações → Tokens** (ou "Gerar token").
2. Marque os escopos: `shipping-calculate`, `shipping-cart`, `shipping-checkout`,
   `shipping-generate`, `shipping-print`, `shipping-tracking`.
3. Copie o token e configure a variável `MELHOR_ENVIO_TOKEN` **no serviço de
   hospedagem** (nunca no código/repositório).
4. **Adicione saldo** à carteira do Melhor Envio — a emissão de etiqueta debita
   o saldo da conta. Sem saldo, o passo de checkout falha com erro claro
   (e o pedido fica pronto para reprocessar quando houver saldo).

---

## 3. Arquivos criados / alterados

### Criados
| Arquivo | Papel |
|---|---|
| `src/services/shipping/melhorenvio-labels.ts` | Camada de API pura do Melhor Envio (cart, checkout, generate, print, tracking) + gate do token pessoal. |
| `src/services/shipping/labels.ts` | Orquestração/regra de negócio: `generateLabelForOrder` (resumível), `refreshTracking`, `refreshAllActiveTracking`. |
| `src/services/notifications/whatsapp.ts` | Envio de WhatsApp agnóstico de provedor + templates "enviado/entregue" + link de rastreio. |
| `src/app/api/admin/orders/[id]/label/route.ts` | `POST` — gera/reprocessa a etiqueta (admin, rate-limit, auditoria). |
| `src/app/api/admin/orders/[id]/label/pdf/route.ts` | `GET` — baixa o PDF (busca URL fresca no ME; admin). |
| `src/app/api/admin/orders/[id]/tracking/route.ts` | `POST` — atualiza o rastreio sob demanda (admin). |
| `src/app/api/cron/tracking/route.ts` | `GET`/`POST` — sincronização periódica de rastreio (protegido por `CRON_SECRET`). |
| `src/components/admin/ShippingLabelPanel.tsx` | Painel no pedido: Gerar etiqueta / Baixar / Copiar código / Atualizar rastreamento + estados/erros. |

### Alterados
| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Novos campos de envio no `Order` (ver §4). |
| `src/services/orders.ts` | `updateOrderStatus` centraliza notificações: **ENVIADO**→e-mail+WhatsApp "enviado", **ENTREGUE**→e-mail+WhatsApp "entregue", demais→e-mail genérico. `ShippingSelection.service` documentado. `createOrder` grava `shippingServiceCode`. |
| `src/lib/email.ts` | Novos templates `sendOrderShipped` e `sendOrderDelivered`. |
| `src/services/shipping/melhorenvio.ts` | Exporta `baseUrl()` e `userAgent()` (reuso pela camada de etiquetas). |
| `src/app/admin/pedidos/[id]/page.tsx` | Monta o `ShippingLabelPanel`. |
| `.env.example` | Novas variáveis (ver §5). |

Nenhuma regra de negócio existente foi removida; a cotação, o checkout e a
retirada na loja continuam idênticos.

---

## 4. Estrutura do banco (novos campos no `Order`)

Aplicados com `npm run db:push` (aditivos e **opcionais** — não afetam dados
existentes).

| Campo | Tipo | Descrição |
|---|---|---|
| `shippingServiceCode` | `String?` | Código do serviço cotado (`me-1`=PAC, `me-2`=SEDEX...). Necessário para montar a etiqueta. Gravado no checkout. |
| `shippingLabelId` | `String?` | ID da etiqueta/pedido no Melhor Envio. |
| `shippingLabelUrl` | `String?` | Última URL conhecida do PDF da etiqueta. |
| `shippingProtocol` | `String?` | Protocolo do Melhor Envio (para suporte). |
| `shippingCompany` | `String?` | Transportadora efetiva (Correios, Jadlog...). |
| `shippingStatus` | `String?` | Status **interno** do envio: `NO_CARRINHO` → `PAGO` → `POSTADO` → `ENTREGUE`. |
| `shippingPostedAt` | `DateTime?` | Quando a etiqueta foi gerada/postada. |
| `shippingDeliveredAt` | `DateTime?` | Quando o rastreio acusou a entrega. |
| `shippingError` | `String?` | Última mensagem de erro (para reprocessar). |
| `trackingCode` | `String?` | *(já existia)* Código de rastreio da transportadora. |

> `shippingStatus` (logística) é independente do `status` comercial do pedido
> (`AGUARDANDO_PAGAMENTO`, `PAGO`, `ENVIADO`, `ENTREGUE`...).

---

## 5. Variáveis de ambiente

Configure **no serviço de hospedagem** (nunca no repositório). Detalhes e
exemplos em `.env.example`.

**Etiqueta (obrigatórias para emitir):**
```
MELHOR_ENVIO_TOKEN=            # token pessoal com escopos de etiqueta
MELHOR_ENVIO_AMBIENTE=producao # ou "sandbox" para testes
MELHOR_ENVIO_FROM_CEP=         # CEP de origem (8 dígitos)
MELHOR_ENVIO_FROM_NAME=        # remetente
MELHOR_ENVIO_FROM_DOCUMENT=    # CNPJ/CPF do remetente (dígitos)
MELHOR_ENVIO_FROM_PHONE=       # telefone com DDD (dígitos)
MELHOR_ENVIO_FROM_EMAIL=       # e-mail do remetente
MELHOR_ENVIO_FROM_ADDRESS=     # logradouro
MELHOR_ENVIO_FROM_NUMBER=      # número
MELHOR_ENVIO_FROM_COMPLEMENT=  # complemento (opcional)
MELHOR_ENVIO_FROM_DISTRICT=    # bairro
MELHOR_ENVIO_FROM_CITY=        # cidade
MELHOR_ENVIO_FROM_STATE=       # UF (2 letras)
```

**WhatsApp automático (opcional):**
```
WHATSAPP_API_URL=      # endpoint POST do provedor (Z-API/Evolution/UltraMsg...)
WHATSAPP_API_TOKEN=    # enviado como Bearer
WHATSAPP_PHONE_FIELD=phone     # nome do campo de telefone (padrão)
WHATSAPP_TEXT_FIELD=message    # nome do campo de texto (padrão)
WHATSAPP_DDI=55        # DDI padrão para números nacionais
```

**Cron de rastreio (opcional, recomendado):**
```
CRON_SECRET=           # segredo forte; sem ele o endpoint fica desligado (401)
```

> **Recibo do cliente (CPF):** para transportadoras que exigem o documento do
> destinatário (ex.: Correios), o CPF é enviado a partir do cadastro do cliente
> (`User.cpf`), quando existir. Se o Melhor Envio recusar por falta de
> documento, o erro aparece no painel e o pedido pode ser reprocessado após o
> preenchimento.

---

## 6. Fluxo operacional do lojista (passo a passo)

1. Abra **Pedidos** e clique no pedido **pago**.
2. No card **Envio / Etiqueta**, clique **Gerar etiqueta**.
   - O sistema cria a etiqueta, salva o **rastreio**, a **transportadora** e o
     **PDF**, e marca o pedido como **Enviado** (o cliente é avisado).
3. Clique **Baixar etiqueta** para abrir o PDF, imprima e cole na embalagem.
4. Copie o **código de rastreio** com **Copiar código**, se precisar.
5. Poste na agência da transportadora.
6. (Opcional) **Atualizar rastreamento** consulta o status na hora. O cron já
   faz isso sozinho e marca **Entregue** quando chega, avisando o cliente.

**Deu erro?** A mensagem aparece no card e o botão vira **Tentar novamente**.
O reprocessamento é **seguro**: se a etiqueta já foi paga, uma nova tentativa
**não cobra o saldo de novo** — ela retoma da geração/impressão.

---

## 7. Notificações ao cliente

Disparadas de dentro do `updateOrderStatus` (valem para qualquer origem da
transição: gerar etiqueta, cron ou ajuste manual de status — **sem
duplicidade**).

| Evento | E-mail | WhatsApp |
|---|---|---|
| Pedido **ENVIADO** | `sendOrderShipped` — rastreio, transportadora e botão "Rastrear" | template "a caminho" com código + link |
| Pedido **ENTREGUE** | `sendOrderDelivered` — convite para avaliar | template "entregue" |
| Demais status | `sendOrderStatusUpdate` (genérico) | — |

- **E-mail:** sem `SMTP_HOST`, apenas registra no console (modo dev).
- **WhatsApp:** sem `WHATSAPP_API_URL`, apenas registra no console. O telefone
  usado é o da **entrega** (senão o do perfil), normalizado para E.164 (+55).
- **Link de rastreio:** `https://www.melhorrastreio.com.br/rastreio/<código>`
  (universal — aceita códigos de qualquer transportadora).

---

## 8. Sincronização de rastreio (cron)

Endpoint `GET /api/cron/tracking` (também aceita `POST`):
- Percorre pedidos **ENVIADO** com etiqueta ativa (limite de 300 por execução).
- Consulta o Melhor Envio; ao acusar **entrega**, marca **ENTREGUE** e notifica.
- Protegido por `CRON_SECRET` — via header `Authorization: Bearer`, header
  `x-cron-secret` ou query `?secret=`. Sem `CRON_SECRET`, responde **401**
  (desligado). Comparação em **tempo constante** (anti-timing-attack).

**Agendamento no VPS (crontab) — a cada 3 horas:**
```
0 */3 * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-DOMINIO/api/cron/tracking >> /var/log/gatafit-cron.log 2>&1
```
> Formato do crontab: `minuto hora dia mês diadasemana`. `*/3` na coluna da hora
> = "a cada 3 horas". Ajuste a frequência ao volume de pedidos.

Webhooks nativos do Melhor Envio ainda são limitados; a estratégia é
**polling** por este cron. Quando/for necessário, um endpoint de webhook pode
ser adicionado reutilizando `refreshTracking`.

---

## 9. Segurança

- **Autorização:** todas as rotas de etiqueta/rastreio usam `requireAdmin`
  (401 sem sessão, 403 sem papel ADMIN) + respeitam o **timeout de sessão admin**.
- **Auditoria:** `label_generate`, `label_generate_error`, `tracking_refresh` e
  `tracking_cron` gravados em `AuditLog` (usuário + IP + detalhe).
- **Rate limit:** emissão `20/5min` por admin; atualização de rastreio `60/5min`
  — evita clique duplo e cobrança acidental de saldo.
- **Segredos:** `MELHOR_ENVIO_TOKEN`, `WHATSAPP_API_TOKEN` e `CRON_SECRET`
  ficam só no servidor (sem `NEXT_PUBLIC_`), nunca versionados.
- **PDF:** baixado via rota protegida que busca uma URL **fresca** no ME
  (a URL da etiqueta não fica exposta publicamente de forma permanente).
- **Idempotência/cobrança:** o `shippingLabelId` e o estado (`NO_CARRINHO`→
  `PAGO`) garantem que um retry **não refaz o checkout já pago**.

---

## 10. Testes

Type-check limpo (`tsc --noEmit`, 0 erros) e suíte de testes
(`scratchpad/test-labels.ts`, **22/22**) cobrindo:

- **Unitário:** normalização de telefone (nacional→+55, remoção de 0, inválidos),
  `parseMeServiceId` (`me-1`→1, número puro, rótulos→null), `trackingUrl`,
  templates de WhatsApp (número/rastreio/transportadora/nome), gate do token.
- **Integração (DB real):**
  - gerar sem `MELHOR_ENVIO_TOKEN` → **422** com mensagem clara;
  - gerar em pedido de **retirada** → **400** (não usa Melhor Envio);
  - gerar sem código de serviço → **400**;
  - rastrear pedido sem etiqueta → **400**;
  - transição **ENVIADO** e **ENTREGUE** gravam status + histórico e disparam
    e-mail + WhatsApp (verificado nos logs de dev).
- **HTTP (servidor rodando):** `POST label`, `POST tracking`, `GET label/pdf`
  sem sessão → **401**; `GET cron` sem/segredo errado → **401**.
- **Cron:** `refreshAllActiveTracking()` executa e retorna `{checked, delivered,
  errors}` sem quebrar.

> A **emissão real** (com débito de saldo) depende do token pessoal + saldo na
> conta Melhor Envio e deve ser validada com **1 pedido de teste** no ambiente
> `producao` (ou em `sandbox`, quando disponível) antes do uso rotineiro.

---

## 11. Manutenção & solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| "Configure MELHOR_ENVIO_TOKEN..." | token pessoal ausente/sem escopos | gerar token com os 6 escopos e configurar no host |
| "Endereço de origem incompleto..." | faltam variáveis `MELHOR_ENVIO_FROM_*` | preencher todas as `FROM_*` (§5) |
| "saldo insuficiente" (mensagem do ME no card) | carteira sem saldo | adicionar saldo → **Tentar novamente** (não cobra em dobro) |
| Etiqueta gera, mas cliente não recebe WhatsApp | provedor não configurado / telefone inválido | conferir `WHATSAPP_*` e o telefone do pedido |
| Entrega não muda para "Entregue" sozinha | cron não agendado / `CRON_SECRET` ausente | configurar `CRON_SECRET` + crontab (§8) |
| Rastreio vazio logo após gerar | transportadora ainda não registrou | normal; o cron/"Atualizar rastreamento" resolve depois |

**Rotina recomendada:** manter saldo no Melhor Envio, o cron ativo e conferir o
`AuditLog` em caso de dúvida sobre uma emissão.
