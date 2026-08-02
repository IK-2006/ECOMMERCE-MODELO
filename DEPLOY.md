# Guia de publicação — Gata Fit

Passo a passo para colocar a loja no ar. O foco é um **VPS Linux** (ex.: Hostinger,
com Ubuntu), mas a parte de banco/variáveis vale para qualquer hospedagem.

---

## 1. Trocar SQLite → PostgreSQL

Em desenvolvimento a loja usa SQLite (arquivo). Em produção use **PostgreSQL**.

1. Em [`prisma/schema.prisma`](prisma/schema.prisma), troque o provider:
   ```prisma
   datasource db {
     provider = "postgresql"   // era "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
2. Aponte `DATABASE_URL` para o Postgres no `.env` de produção:
   ```env
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/gatafit?schema=public"
   ```

O schema é 100% compatível (valores em centavos/Int, status como String) — nada mais muda.

---

## 2. Variáveis de ambiente de produção

Crie o `.env` no servidor a partir do [`.env.example`](.env.example). **Obrigatórias/diferentes de dev:**

```env
# App
NEXTAUTH_URL="https://usegatafit.com.br"
NEXT_PUBLIC_APP_URL="https://usegatafit.com.br"
NEXTAUTH_SECRET="<gere um novo: openssl rand -base64 32>"   # NÃO reutilize o de dev

# Banco
DATABASE_URL="postgresql://..."

# Mercado Pago — credenciais de PRODUÇÃO (APP_USR-...) da conta real
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
MERCADOPAGO_WEBHOOK_SECRET="<assinatura secreta do webhook>"

# Melhor Envio — já funciona (client_credentials)
MELHOR_ENVIO_CLIENT_ID="..."
MELHOR_ENVIO_CLIENT_SECRET="..."
MELHOR_ENVIO_FROM_CEP="99300000"

# E-mail (SMTP do provedor: Brevo, Resend, etc.)
SMTP_HOST="..."; SMTP_PORT="587"; SMTP_USER="..."; SMTP_PASS="..."
SMTP_FROM="Gata Fit <no-reply@usegatafit.com.br>"

# Dados da loja (rodapé + páginas legais)
STORE_LEGAL_NAME="..."; STORE_CNPJ="..."; STORE_LEGAL_ADDRESS="..."
STORE_CONTACT_EMAIL="contato@usegatafit.com.br"
STORE_WHATSAPP="5551999999999"   # só dígitos, com DDI

# Retirada na loja
STORE_PICKUP_ADDRESS="Av. Maurício Cardoso, 944 — Centro, Soledade/RS"
```

> Gere o `NEXTAUTH_SECRET` com `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

---

## 3. Preparar o servidor (VPS Ubuntu)

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql
sudo -u postgres psql -c "CREATE DATABASE gatafit;"
sudo -u postgres psql -c "CREATE USER gatafit WITH PASSWORD 'senha-forte';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gatafit TO gatafit;"

# PM2 (mantém o site rodando e reinicia sozinho)
sudo npm install -g pm2
```

---

## 4. Subir o código e iniciar

```bash
# no servidor, dentro da pasta do projeto:
npm install
npx prisma db push          # cria as tabelas no Postgres
ADMIN_EMAIL="voce@usegatafit.com.br" ADMIN_PASSWORD="senha-forte-admin" npm run db:seed:prod
npm run build
pm2 start "npm run start" --name gatafit
pm2 save && pm2 startup     # inicia junto com o servidor
```

A loja sobe em `http://localhost:3000` no servidor. O passo 5 expõe com HTTPS.

---

## 5. Domínio + HTTPS (Caddy — SSL automático)

O **Caddy** faz proxy reverso e cuida do certificado SSL sozinho (renova automático):

```bash
sudo apt-get install -y caddy
```
`/etc/caddy/Caddyfile`:
```
usegatafit.com.br, www.usegatafit.com.br {
    reverse_proxy localhost:3000
}
```
```bash
sudo systemctl reload caddy
```
No **Registro.br**, aponte o domínio (registro A) para o **IP do VPS**. Pronto: `https://usegatafit.com.br` no ar, com cadeado.

---

## 6. Webhook do Mercado Pago (importante!)

Sem isso, o pedido não muda para "Pago" sozinho após o pagamento.

No painel do Mercado Pago → sua aplicação → **Webhooks**, cadastre:
- URL: `https://usegatafit.com.br/api/webhooks/mercadopago`
- Evento: **Pagamentos**
- Copie a **Assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET` no `.env` e reinicie (`pm2 restart gatafit`).

---

## 7. Backup automático (diário)

As fotos ficam em `public/uploads`. Um cron simples protege banco + fotos:

`/etc/cron.daily/backup-gatafit` (torne executável: `chmod +x`):
```bash
#!/bin/bash
DIR=/var/backups/gatafit; mkdir -p $DIR
pg_dump -U gatafit gatafit | gzip > $DIR/db-$(date +%F).sql.gz
tar czf $DIR/uploads-$(date +%F).tar.gz -C /caminho/do/projeto/public uploads
find $DIR -mtime +14 -delete   # mantém 14 dias
```

---

## 8. Segurança do servidor (hardening)

**Firewall (ufw)** — libere só o essencial; o banco NUNCA fica exposto:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80,443/tcp    # web (Caddy)
sudo ufw enable
```

**Banco só pela aplicação** — o Postgres escuta apenas `localhost` por padrão no Ubuntu; a `DATABASE_URL` deve usar `localhost` e a porta 5432 **não** deve ser liberada no firewall. Confirme que não está exposto:
```bash
sudo ss -tlnp | grep 5432    # deve mostrar 127.0.0.1:5432, nunca 0.0.0.0
```

**SSH + atualizações** — use chave (desative login por senha) e ative updates de segurança automáticos:
```bash
sudo apt-get install -y unattended-upgrades fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```
`fail2ban` bane IPs após várias falhas de SSH (defesa extra, além do rate-limit da app).

**Proxy confiável (importante para o rate-limit)** — com o Caddy na frente, adicione no `.env`:
```env
TRUSTED_PROXY_HOPS=1
```
Assim o rate-limit usa o IP real do visitante (anexado pelo Caddy), e não um `X-Forwarded-For` falsificável.

**Anti-DDoS / WAF** — aponte o DNS do domínio para o **Cloudflare** (o plano free já dá proteção de borda + cache). O Caddy (seção 5) já termina o TLS e a app envia HSTS + CSP + demais cabeçalhos automaticamente.

**Monitoramento** — dois serviços gratuitos deixam a operação observável:
- **Sentry** (erros do servidor): crie um projeto em [sentry.io](https://sentry.io), copie o DSN e coloque `SENTRY_DSN` no `.env` do servidor (não no repositório). Sem DSN o monitoramento fica desligado. Já está integrado no código (`src/instrumentation.ts` + handler de erros).
- **UptimeRobot** (disponibilidade): crie um monitor HTTP apontando para `https://usegatafit.com.br/api/health` — a app responde `200 {status:"ok"}` quando está no ar e `503` se o banco cair. Configure alerta por e-mail/telegram.

**Tráfego pago (Meta Pixel + Conversões + Google)** — para os anúncios medirem venda:
1. No **Gerenciador de Eventos** da Meta, crie o Pixel e gere um **token da API de Conversões**. Preencha no `.env`: `NEXT_PUBLIC_META_PIXEL_ID` e `META_CAPI_ACCESS_TOKEN`.
2. (Opcional) Crie uma propriedade no **Google Analytics 4** e preencha `NEXT_PUBLIC_GA4_ID`.
3. No **Gerenciador de Catálogo** da Meta (e/ou Google Merchant Center), cadastre o feed de produtos: `https://usegatafit.com.br/feed/produtos.xml`.
4. Reinicie (`pm2 restart gatafit`). Sem esses valores o rastreamento fica desligado; o rastreio no navegador só dispara após o visitante aceitar os cookies (LGPD).

---

## 9. Restaurar um backup (disaster recovery)

Teste a restauração **antes** de precisar — de preferência numa base de staging:
```bash
# banco
gunzip -c /var/backups/gatafit/db-2026-07-28.sql.gz | psql -U gatafit gatafit
# fotos
tar xzf /var/backups/gatafit/uploads-2026-07-28.tar.gz -C /caminho/do/projeto/public
pm2 restart gatafit
```

---

## 10. Atualizações futuras

```bash
git pull            # (ou envie os arquivos)
npm install
npx prisma db push  # se o schema mudou
npm run build
pm2 restart gatafit
```

---

## Alternativa: Vercel (gerenciado, sem servidor)

1. Conecte o repositório na Vercel.
2. Provisione um Postgres (integração **Neon** no marketplace — injeta a `DATABASE_URL`).
3. Configure as variáveis de ambiente (seção 2).
4. **Importante:** no Vercel o upload de fotos em `public/uploads` NÃO persiste —
   troque `src/services/storage.ts` por Cloudinary/S3 (o código já está isolado
   para isso). No VPS isso não é necessário (disco persistente).
