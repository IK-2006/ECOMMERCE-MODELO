# Gata Fit — Plataforma de E-commerce

Loja virtual **completa** da **Gata Fit** (moda feminina: fitness, praia e pijamas), com **painel administrativo**, **PDV (venda no balcão)**, pagamento via **Mercado Pago**, frete pelos **Correios/Melhor Envio**, **rastreamento para tráfego pago** (Meta Pixel + Conversões + Google Analytics) e segurança de nível profissional. Design premium minimalista, responsivo e com tema claro/escuro.

> Sistema sob medida — a loja é **dona do código e dos dados**, sem taxa por venda de plataforma. Produtos de exemplo no seed; troque pelas fotos/dados reais no painel.

---

## 🧰 Tecnologias

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack, Server Components) |
| **Linguagem** | TypeScript 5 |
| **UI** | React 19 · Tailwind CSS 4 · fontes Cormorant Garamond + Inter |
| **Banco de dados** | Prisma ORM 6 — SQLite (dev) / PostgreSQL (produção) |
| **Autenticação** | NextAuth 4 (sessão JWT cifrada) · bcrypt · 2FA TOTP (otplib) |
| **Validação** | Zod (toda entrada de API) |
| **Pagamento** | SDK Mercado Pago (Checkout Pro) + webhook HMAC |
| **Frete** | Melhor Envio (Correios) · Correios CWS · tabela interna |
| **Gráficos** | Recharts (dashboard) |
| **Marketing** | Meta Pixel + API de Conversões (CAPI) · Google Analytics 4 · feed de catálogo |
| **Monitoramento** | Sentry (erros) · health check para UptimeRobot |
| **E-mail** | Nodemailer (SMTP) |

---

## ✨ Tudo que o sistema tem

### 🛍️ Loja (cliente)
- **Catálogo** com busca, filtros (categoria, preço, avaliação) e **ordenação** (menor/maior preço, novidades, avaliação)
- **Página de produto**: galeria de imagens, **variações** (tamanho/cor/etc.), preço "de/por", estoque, avaliações com estrelas, produtos relacionados, **cálculo de frete** por CEP e botão de lista de desejos
- **Carrinho** persistente
- **Lista de desejos** (favoritos)
- **Avaliações** de produtos (com selo de compra verificada)
- **Checkout em etapas**: escolha de entrega (**receber em casa** ou **retirar na loja**), endereço com **autopreenchimento por CEP** (ViaCEP), frete pelos Correios, cupom e pagamento
- **Retirada na loja** — grátis, sem endereço de entrega
- **Cupons de desconto** (percentual, valor fixo ou frete grátis)
- **Minha Conta**: dados pessoais, **pedidos com acompanhamento de status e rastreio**, endereços, troca de senha, ativação de **2FA** e **solicitação de reembolso/devolução**
- **Autenticação**: cadastro, login (e-mail/senha + **Google** opcional), recuperação de senha por e-mail
- **Tema claro/escuro** (dark mode)
- **Páginas legais**: Política de Privacidade (LGPD), Termos de Uso, Trocas e Devoluções
- **SEO**: sitemap, robots e Open Graph por produto (compartilhamento bonito)
- **Botão flutuante de WhatsApp** e **banner de consentimento de cookies** (LGPD)

### 🖥️ Painel administrativo
- **Dashboard**: faturamento dos últimos 30 dias (com comparativo), gráfico diário, ticket médio, pedidos pagos, **alerta de estoque baixo**, mais vendidos e pedidos recentes
- **Produtos**: cadastro/edição completo, **variações**, upload de imagens, **SKU gerado automaticamente**, controle de estoque, busca e ordenação
- **Categorias**: cadastro/edição
- **Pedidos**: lista com filtros por status e busca, detalhe, **mudança de status** com histórico, código de rastreio e **e-mail automático** ao cliente; selo de canal (**Loja** x Site)
- **🏷️ Etiquetas Melhor Envio**: **gerar etiqueta** pelo painel (paga com o saldo da conta), **baixar o PDF**, **copiar o rastreio** e **atualizar rastreamento**; ao gerar, o pedido vira **Enviado** e o cliente é avisado por **e-mail + WhatsApp**; a **entrega** é confirmada automaticamente por um **cron de rastreio** (detalhes em `MELHOR-ENVIO-ETIQUETAS.md`)
- **Reembolsos & devoluções**: gerencia as solicitações dos clientes (analisar → aprovar/recusar → concluir, com **devolução automática ao estoque**)
- **🛒 Venda em Loja (PDV)**: terminal de caixa para vendas presenciais — **dinheiro (com troco), Pix, cartão**; baixa de estoque na hora, entra nos relatórios e emite **recibo imprimível**
- **Clientes**: lista e detalhe (histórico de compras)
- **Cupons**: criação com percentual/valor fixo/frete grátis, validade e limites de uso
- **Frete**: tabela interna cadastrável (faixas de CEP + peso → preço/prazo)
- **Relatórios** de vendas
- **Controle de estoque**: toda movimentação é registrada (venda, reposição, ajuste, devolução)
- **2FA (autenticação em dois fatores)** e **sessão de admin com expiração automática** por segurança
- **Trilha de auditoria** de todas as ações

### 💳 Pagamento (Mercado Pago)
- Checkout Pro: **Pix, cartão em até 12x e boleto**
- Webhook com **validação de assinatura HMAC** + idempotência (atualiza o pedido para Pago/Cancelado/Reembolsado automaticamente)
- **Gateway simulado** local enquanto não há credenciais — permite testar todo o fluxo

### 📦 Frete
- **Melhor Envio** (Correios, sem contrato próprio) · **Correios CWS** (com contrato) · **tabela interna** (fallback que nunca deixa o checkout quebrar) · **retirada na loja**

### 📣 Tráfego pago / Marketing
- **Meta Pixel** + **API de Conversões (CAPI)** server-side com **deduplicação** (evento de compra confiável mesmo com bloqueadores/iOS)
- Eventos: PageView, ViewContent, AddToCart, InitiateCheckout e **Purchase (com valor)**
- **Google Analytics 4**
- **Feed de catálogo** (`/feed/produtos.xml`) para anúncios dinâmicos (Meta/Google)
- Rastreamento só após **consentimento** (LGPD)

### 🔒 Segurança e 🩺 Monitoramento
- Detalhes completos em [SECURITY-AUDIT.md](SECURITY-AUDIT.md). Resumo na seção abaixo.
- **Sentry** (erros do servidor) e **health check** (`/api/health`) para UptimeRobot.

---

## 🚀 Como rodar localmente

Pré-requisito: **Node.js 20+**. Em dev o banco é SQLite (arquivo local, zero configuração).

```bash
npm install                 # 1. dependências
copy .env.example .env      # 2. variáveis (Windows) — Linux/Mac: cp .env.example .env
npm run db:push             # 3. cria o banco
npm run db:seed             #    popula dados de exemplo
npm run dev                 # 4. sobe o servidor
```

Acesse **http://localhost:3000**.

### Contas de demonstração (criadas pelo seed)

| Perfil  | E-mail              | Senha        | Acesso                        |
| ------- | ------------------- | ------------ | ----------------------------- |
| Admin   | `admin@loja.com`    | `admin123`   | http://localhost:3000/admin   |
| Cliente | `cliente@teste.com` | `cliente123` | loja + Minha Conta            |

O seed cria os produtos de exemplo (Moda Fitness, Moda Praia, Pijamas & Loungewear) com variações, avaliações, cupons (`BEMVINDA10`, `GATA20`, `FRETEGRATIS`), tabela de frete e pedidos de exemplo para o dashboard.

> **Pagamento sem credenciais**: enquanto o Mercado Pago não estiver no `.env`, o checkout usa um **gateway simulado** local (você escolhe aprovar/recusar e testa pedido, e-mail, estoque e status). Ao preencher as credenciais, o Checkout Pro real assume automaticamente.

---

## 🗂️ Estrutura do projeto

```
prisma/
  schema.prisma            # modelo de dados (produtos, variações, pedidos,
                           #   reembolsos, cupons, estoque, auditoria, ...)
  seed.ts                  # dados de exemplo (dev)
  seed-prod.ts             # seed mínimo de produção (admin)
src/
  app/(store)/             # loja: home, catálogo, produto, carrinho, checkout,
                           #   conta, favoritos, auth, páginas legais
  app/admin/               # painel: dashboard, produtos, categorias, pedidos,
                           #   reembolsos, pdv, clientes, cupons, frete, relatórios
  app/api/                 # rotas de API (auth, cart, checkout, shipping, coupons,
                           #   reviews, wishlist, health, webhooks, admin/*)
  app/feed/produtos.xml/   # feed de catálogo para anúncios
  components/
    ui/                    # componentes reutilizáveis (Button, Input, Modal, ...)
    store/                 # componentes da loja
    admin/                 # componentes do painel
    tracking/              # Analytics, consentimento e eventos de conversão
    providers/             # Theme, Toast, Cart, Consent
  lib/                     # prisma, auth, validações Zod, rate limit, e-mail,
                           #   auditoria, tracking, sessão de admin, helpers
  services/
    payments/mercadopago.ts    # Checkout Pro + webhook + assinatura
    shipping/                  # Melhor Envio + Correios + tabela interna
    tracking/meta-capi.ts      # API de Conversões da Meta (server-side)
    orders.ts · store-sale.ts  # pedidos online e venda no balcão (PDV)
    refunds.ts · coupons.ts · stock.ts · storage.ts
  instrumentation.ts       # inicialização do Sentry
DEPLOY.md                  # guia de publicação (VPS, HTTPS, backup, hardening)
SECURITY-AUDIT.md          # relatório e manual de segurança
```

---

## ⚙️ Configuração

Todas as chaves ficam no `.env` (nunca no código; o `.env` é ignorado pelo git). Veja o [`.env.example`](.env.example) para a lista completa comentada.

### 💳 Mercado Pago
```env
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."   # produção (ou TEST-... no sandbox)
MERCADOPAGO_WEBHOOK_SECRET="..."         # assinatura secreta do webhook
```
Cadastre o webhook `https://SEU_DOMINIO/api/webhooks/mercadopago` (evento **Pagamentos**) no painel do MP. Em dev, exponha com `ngrok http 3000`. Cartão de teste: `5031 4332 1540 6351`, venc. `11/30`, CVV `123`, nome `APRO` (aprova).

### 📦 Frete (Melhor Envio — recomendado, sem contrato)
```env
MELHOR_ENVIO_CLIENT_ID="..."
MELHOR_ENVIO_CLIENT_SECRET="..."
MELHOR_ENVIO_FROM_CEP="99300000"                 # CEP de origem
MELHOR_ENVIO_TRANSPORTADORAS="Correios"          # vazio = todas
STORE_PICKUP_ENABLED="true"                        # oferecer retirada na loja
STORE_PICKUP_ADDRESS="Av. ... , Cidade/UF"
```
Cotar frete **não gera custo** (paga só a etiqueta). Se o provedor cair, o sistema volta sozinho para a tabela interna cadastrada em `/admin/frete`.

### 📣 Tráfego pago (opcional)
```env
NEXT_PUBLIC_META_PIXEL_ID="..."     # ID do Pixel (público)
META_CAPI_ACCESS_TOKEN="..."        # token da API de Conversões (SEGREDO, só servidor)
NEXT_PUBLIC_GA4_ID="G-..."          # Google Analytics 4 (opcional)
```
Sem esses valores o rastreamento fica desligado. Cadastre `https://SEU_DOMINIO/feed/produtos.xml` no Gerenciador de Catálogo da Meta / Google Merchant Center.

### ✉️ E-mail, 🔐 Google e 🩺 Monitoramento
```env
SMTP_HOST="..."; SMTP_PORT="587"; SMTP_USER="..."; SMTP_PASS="..."   # transacionais
GOOGLE_CLIENT_ID=""; GOOGLE_CLIENT_SECRET=""                          # login Google (opcional)
SENTRY_DSN=""                                                         # monitor de erros (opcional)
```
Sem `SMTP_HOST`, os e-mails são apenas logados no console (o link de recuperação de senha aparece lá).

---

## 🗄️ Banco de dados

- **Dev**: SQLite (`prisma/dev.db`) — zero configuração.
- **Produção**: PostgreSQL. Em `prisma/schema.prisma` troque `provider = "sqlite"` por `"postgresql"`, aponte `DATABASE_URL` e rode `npx prisma db push`.

O schema é 100% compatível com os dois (valores monetários em centavos/`Int`, status como `String` validadas por Zod).

```bash
npm run db:push      # sincroniza o schema com o banco
npm run db:seed      # dados de exemplo (dev)
npm run db:reset     # recria o banco do zero + seed
npx prisma studio    # interface visual do banco
```

---

## 🛡️ Segurança (resumo)

Auditoria completa em [SECURITY-AUDIT.md](SECURITY-AUDIT.md). Em resumo:

- **Injeção**: Prisma parametriza tudo (sem SQLi); Zod valida toda entrada (sem NoSQLi); React escapa a saída (sem XSS)
- **Senhas** com bcrypt; **sessão** em JWT cifrado; **2FA TOTP** para o admin
- **Cookies** HttpOnly + SameSite + Secure; **sem token em localStorage**
- **RBAC** (middleware + por rota), **IDOR** protegido, **sessão de admin** com expiração
- **Rate limiting** por IP/usuário/e-mail (lendo o IP real do proxy)
- **Uploads** validados por magic bytes (só imagens, nome aleatório)
- **Integridade de preço/estoque** recalculada no servidor (checkout e PDV)
- **Cabeçalhos** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- **Segredos** fora do código (`.env` não versionado); **auditoria** completa + eventos de login/brute-force
- **Dependências** auditadas (`npm audit`)

---

## 🚢 Publicação

Guia passo a passo (VPS Linux, PostgreSQL, HTTPS com Caddy, webhook, backup diário, hardening de firewall e restauração) em **[DEPLOY.md](DEPLOY.md)**. Também roda em Vercel (com Postgres gerenciado + storage externo para as imagens).

---

## 📜 Scripts

| Comando               | Descrição                              |
| --------------------- | -------------------------------------- |
| `npm run dev`         | servidor de desenvolvimento            |
| `npm run build`       | build de produção                      |
| `npm start`           | roda o build de produção               |
| `npm run db:push`     | aplica o schema no banco               |
| `npm run db:seed`     | popula dados de exemplo                |
| `npm run db:seed:prod`| seed mínimo de produção (admin)        |
| `npm run db:reset`    | recria o banco + seed                  |

---

## 🖼️ Imagens

Upload do admin salvo em `/public/uploads` (dev/VPS). Para S3/Cloudinary, altere apenas `saveImage()` em `src/services/storage.ts` mantendo a assinatura — o resto do código não muda.
