# Guia de publicação — Gata Fit

Passo a passo para colocar a loja no ar. O foco é um **VPS Linux** (ex.: Hostinger,
com Ubuntu), mas a parte de banco/variáveis vale para qualquer hospedagem.

---

## 0. Roteiro Hostinger KVM 1 (do zero ao ar)

Guia linear pra seguir batido depois de contratar o **KVM 1**. As seções 1–10 detalham cada parte.

**Ordem:** `0` (servidor + código) → `2` (variáveis) → `0.5` (1ª publicação) → `5` (domínio/HTTPS) → `6` (webhook) → `7` (backup) → `8` (segurança).

### 0.1 Criar o VPS
1. No painel da Hostinger, abra o **KVM 1** → **Sistema operacional** → escolha **Ubuntu 24.04 LTS** (sem painel/limpo). Defina uma **senha de root** forte.
2. Anote o **IP do VPS** (aparece no painel, ex.: `191.101.x.x`).

### 0.2 Primeiro acesso + usuário + swap
```bash
ssh root@SEU_IP                 # do seu PC
apt update && apt upgrade -y

# usuário de deploy (não trabalhe como root direto)
adduser deploy && usermod -aG sudo deploy

# swap de 2 GB (folga extra para o build; o KVM 1 tem 4 GB de RAM)
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

su - deploy                     # daqui pra frente, como "deploy"
```

### 0.3 Instalar Node, PostgreSQL, Caddy e PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql caddy
sudo npm install -g pm2

sudo -u postgres psql -c "CREATE DATABASE gatafit;"
sudo -u postgres psql -c "CREATE USER gatafit WITH PASSWORD 'senha-forte-do-banco';"
sudo -u postgres psql -c "ALTER DATABASE gatafit OWNER TO gatafit;"
```

### 0.4 Pegar o código (repositório PRIVADO via deploy key)
O repositório é privado; o servidor autentica com uma **chave de deploy** (só leitura):
```bash
ssh-keygen -t ed25519 -C "deploy-gatafit" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
Copie a chave e cole no GitHub: **repositório → Settings → Deploy keys → Add deploy key** (deixe *Allow write access* DESMARCADO). Depois:
```bash
git clone git@github.com:IK-2006/ECOMMERCE-MODELO.git ~/gatafit
cd ~/gatafit
```

### 0.5 Primeira publicação
1. Crie o **`.env`** (veja a seção 2 — todas as variáveis de produção).
2. Instale, prepare o banco e crie o admin:
   ```bash
   npm install
   sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
   npx prisma db push
   ADMIN_EMAIL="voce@usegatafit.com.br" ADMIN_PASSWORD="senha-forte-admin" npm run db:seed:prod
   ```
3. Suba com o PM2:
   ```bash
   npm run build
   pm2 start "npm run start" --name gatafit
   pm2 save
   pm2 startup      # rode o comando que ele imprimir (sobe junto com o servidor)
   ```

Agora faça o **domínio/HTTPS** (seção 5), o **webhook** (6), o **backup** (7) e a **segurança** (8). Loja no ar. ✅

### 0.6 Atualizações futuras — 1 comando
Crie `~/gatafit/deploy.sh` (evita a pegadinha do `git pull` reverter o provider para sqlite):
```bash
#!/bin/bash
set -e
cd ~/gatafit
git pull
# produção usa PostgreSQL (o schema versionado fica em sqlite para o dev)
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
npm install
npx prisma db push
npm run build
pm2 restart gatafit
```
```bash
chmod +x ~/gatafit/deploy.sh
```
Daí em diante, para publicar qualquer mudança: **`./deploy.sh`**.

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

> No servidor essa troca é **automática** (o `deploy.sh` da seção 0.6 aplica com `sed`). **Não comite** a mudança para `postgresql`: o schema versionado fica em `sqlite` para o ambiente de desenvolvimento continuar funcionando sem instalar nada.

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

# E-mail — Brevo (plano grátis 300/dia). Veja "E-mail com Brevo" abaixo.
SMTP_HOST="smtp-relay.brevo.com"; SMTP_PORT="587"
SMTP_USER="<login que o Brevo mostra em SMTP>"; SMTP_PASS="<SMTP key do Brevo>"
SMTP_FROM="Gata Fit <contato@usegatafit.com.br>"   # remetente VERIFICADO no Brevo

# Dados da loja (rodapé + páginas legais)
STORE_LEGAL_NAME="..."; STORE_CNPJ="..."; STORE_LEGAL_ADDRESS="..."
STORE_CONTACT_EMAIL="contato@usegatafit.com.br"
STORE_WHATSAPP="5551999999999"   # só dígitos, com DDI

# Retirada na loja
STORE_PICKUP_ADDRESS="Av. Maurício Cardoso, 944 — Centro, Soledade/RS"
```

> Gere o `NEXTAUTH_SECRET` com `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

### E-mail com Brevo (grátis, 300 e-mails/dia)

A loja envia e-mails transacionais (pedido recebido, pago, **enviado com rastreio**, entregue, reembolso, redefinição de senha). Sem SMTP configurado, eles só aparecem no log do servidor.

**Passo a passo:**
1. Crie a conta em **https://www.brevo.com** (plano gratuito).
2. Menu **Transactional → Email → SMTP & API**, aba **SMTP**. Anote:
   - **Server**: `smtp-relay.brevo.com` · **Port**: `587`
   - **Login**: o e-mail mostrado ali → vai em `SMTP_USER`
   - **SMTP key** (botão *Generate a new SMTP key*): a chave gerada → vai em `SMTP_PASS`
     *(é a "SMTP key", NÃO a senha de acesso ao painel)*
3. Em **Senders, Domains & Dedicated IPs**:
   - **Verifique o remetente** que você vai usar em `SMTP_FROM` (ex.: `contato@usegatafit.com.br`). Sem verificar, o Brevo recusa o envio.
   - **Autentique o domínio** (recomendado): o Brevo mostra os registros **SPF** (`TXT`) e **DKIM** (`TXT`/`CNAME`) para adicionar no **DNS** do domínio. Isso é o que faz o e-mail cair na **caixa de entrada** em vez do spam.
4. Preencha `SMTP_HOST/PORT/USER/PASS/FROM` no serviço de hospedagem (nunca no código).
5. **Teste o envio de verdade:**
   ```bash
   npm run email:test -- voce@email.com
   ```
   O comando verifica a conexão SMTP e envia um e-mail de teste. Confira a caixa de entrada (e o spam).

> **Volume:** o plano grátis cobre 300 e-mails/dia — folgado para a escala da loja. Se um dia crescer muito, dá para subir de plano no Brevo ou trocar por Amazon SES (mais barato em volume) sem mudar o código, só as variáveis SMTP.

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
# torna o usuário DONO do banco (no PG 15+ só GRANT não deixa criar tabelas no schema public)
sudo -u postgres psql -c "ALTER DATABASE gatafit OWNER TO gatafit;"

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

**Apontar o domínio (DNS):** no painel onde o domínio da loja está (Registro.br, Hostinger, etc.), crie **dois registros A** apontando para o **IP do VPS**:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` (raiz) | `SEU_IP` |
| A | `www` | `SEU_IP` |

A propagação leva de minutos a algumas horas. Assim que resolver, o Caddy emite o certificado SSL sozinho e `https://usegatafit.com.br` fica no ar com cadeado (renovação automática).

> **Se a Gata Fit já tem o domínio**, é só criar/editar esses registros A no provedor atual — não precisa transferir nada.
> **Cloudflare (opcional):** comece com **DNS-only** (nuvem cinza) para o Caddy conseguir emitir o certificado; depois, se ligar o proxy (nuvem laranja), use **SSL/TLS = Full (strict)** para não dar loop de redirecionamento.

---

## 6. Webhook do Mercado Pago (importante!)

Sem isso, o pedido não muda para "Pago" sozinho após o pagamento.

No painel do Mercado Pago → sua aplicação → **Webhooks**, cadastre:
- URL: `https://usegatafit.com.br/api/webhooks/mercadopago`
- Evento: **Pagamentos**
- Copie a **Assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET` no `.env` e reinicie (`pm2 restart gatafit`).

---

## 7. Backup automático (diário) — grátis

O que precisa sobreviver: o **banco** (pedidos + clientes) e as **fotos** (`public/uploads`). O código já está no GitHub.

`/etc/cron.daily/backup-gatafit` (depois: `sudo chmod +x /etc/cron.daily/backup-gatafit`):
```bash
#!/bin/bash
DIR=/var/backups/gatafit; mkdir -p $DIR
# dump como usuário postgres (peer auth — sem senha; o cron roda como root)
sudo -u postgres pg_dump gatafit | gzip > $DIR/db-$(date +%F).sql.gz
tar czf $DIR/uploads-$(date +%F).tar.gz -C /home/deploy/gatafit/public uploads
find $DIR -mtime +14 -delete   # mantém 14 dias

# CÓPIA EXTERNA (recomendado) — sobrevive à perda do VPS. Descomente após configurar:
# rclone copy $DIR b2:SEU-BUCKET/gatafit --max-age 2d
```

> ⚠️ **Backup só no mesmo VPS não vale se o servidor morrer.** Envie uma cópia pra fora — o **Backblaze B2** dá 10 GB grátis (sobra muito):
> ```bash
> sudo apt-get install -y rclone
> rclone config    # crie um remote "b2" (Backblaze B2) — só uma vez
> ```
> Depois é só descomentar a linha `rclone copy` acima.

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

Com o `deploy.sh` da seção 0.6, publicar qualquer mudança é **um comando**:
```bash
cd ~/gatafit && ./deploy.sh
```
Ele faz `git pull` → aplica o provider PostgreSQL → `npm install` → `prisma db push` (se o schema mudou) → `build` → `pm2 restart`. Use sempre ele em vez dos passos soltos, para não esquecer a troca do provider.

---

## Alternativa: Vercel (gerenciado, sem servidor)

1. Conecte o repositório na Vercel.
2. Provisione um Postgres (integração **Neon** no marketplace — injeta a `DATABASE_URL`).
3. Configure as variáveis de ambiente (seção 2).
4. **Importante:** no Vercel o upload de fotos em `public/uploads` NÃO persiste —
   troque `src/services/storage.ts` por Cloudinary/S3 (o código já está isolado
   para isso). No VPS isso não é necessário (disco persistente).
