# 🔐 Documento de Segurança — Gata Fit E-commerce

**Última atualização:** 30/07/2026
**Escopo:** aplicação completa — front-end, APIs, autenticação, autorização, banco de dados, uploads, pagamento (Mercado Pago), frete (Correios via Melhor Envio), PDV, reembolsos, monitoramento e infraestrutura.
**Metodologia:** mapeamento → revisão de código → varredura de dependências → pentest automatizado (OWASP Top 10) → correção → re-teste sem regressão.
**Princípio:** *nunca confiar em dados vindos do cliente*; validar e recalcular tudo no servidor. Nenhuma funcionalidade ou regra de negócio foi removida durante o hardening.

---

## 1. Resumo executivo

A aplicação tem **postura de segurança sólida** e está pronta para produção seguindo o guia de deploy. A arquitetura neutraliza **por construção** as classes de ataque mais graves — não dependendo de "lembrar de sanitizar":

- **Prisma** parametriza 100% das queries → **sem SQL Injection**.
- **Zod** valida tipo/formato de toda entrada → **sem NoSQL Injection / mass-assignment**.
- **React** escapa toda saída → **sem XSS** refletido/armazenado.
- **NextAuth** guarda a sessão em **JWT cifrado (JWE)** dentro de cookie **HttpOnly** → **sem roubo de token por XSS**.
- **RBAC** em middleware + por rota → **sem escalada de privilégio / IDOR**.

Todas as vulnerabilidades encontradas nas auditorias foram **corrigidas e re-testadas**. Restam apenas pendências de **infraestrutura** (a configurar no deploy) e **3 CVEs de dependência não-exploráveis** nesta configuração (detalhes na §13).

---

## 2. Stack de segurança — tecnologias e ferramentas

Cada tecnologia abaixo cumpre um papel específico de segurança:

| Tecnologia / Ferramenta | Camada | Como é usada para segurança |
|---|---|---|
| **Prisma ORM** 6.19 | Banco | Queries 100% parametrizadas (prepared statements). Zero SQL montado à mão → imune a SQLi. |
| **Zod** 3.25 | API | Valida e faz *type-coercion* de todo corpo de requisição antes de tocar no banco (tipo, tamanho, formato, obrigatoriedade, enums). |
| **NextAuth** 4.24.15 | Autenticação | Sessão via **JWT cifrado (JWE)** em cookie **HttpOnly + SameSite=Lax + Secure**. CSRF token embutido. |
| **bcryptjs** 3.0 | Senhas | Hash de senha com *salt* (bcrypt). Nunca texto puro, MD5 ou SHA1. |
| **otplib** 12.0 | MFA | 2FA por **TOTP** (Google Authenticator/Authy) para o admin. |
| **React** 19 | Front-end | Escapa automaticamente toda interpolação → previne XSS. Sem `dangerouslySetInnerHTML`. |
| **Rate limiter próprio** | API | Janela deslizante em memória, por **IP / usuário / e-mail** em login, cadastro, checkout, reembolso. |
| **Cabeçalhos de segurança** (next.config) | HTTP | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. |
| **Validação por magic bytes** (storage.ts) | Uploads | Aceita imagem só se a **assinatura binária** bater (não pelo Content-Type). Bloqueia SVG/scripts/executáveis. |
| **Trilha de auditoria** (`AuditLog`) | Monitoramento | Registra quem/o quê/quando/IP em ações sensíveis + eventos de login/logout/brute-force. |
| **Sentry** (`@sentry/nextjs`) | Monitoramento | Captura erros do servidor (checkout, pagamento, webhook). Só servidor, sem PII. |
| **Health check** (`/api/health`) | Disponibilidade | Endpoint para UptimeRobot monitorar app + banco. |
| **Caddy** (proxy reverso) | Infra | Termina TLS, gera/renova SSL automático, redireciona HTTP→HTTPS. |
| **Cloudflare** | Infra | WAF + proteção anti-DDoS de borda (recomendado no deploy). |
| **ufw + fail2ban** | Infra | Firewall (só 22/80/443) + banimento de IPs após falhas de SSH. |

---

## 3. Autenticação (`src/lib/auth.ts`)

**Como funciona:** login por e-mail/senha (NextAuth `CredentialsProvider`) ou Google (opcional). O provider `authorize`:

1. **Compara a senha** com o hash bcrypt (`bcrypt.compare`) — nunca compara texto puro.
2. **Rate limit de tentativas FALHAS** (não penaliza login legítimo): **5 por e-mail** e **20 por IP** a cada 15 min. O IP vem de `clientIpFromForwardedFor()` (à direita do `X-Forwarded-For`, à prova de spoofing).
3. **2FA (TOTP)**: se ativo para a conta, exige o código de 6 dígitos do app autenticador; código inválido tem rate limit próprio.
4. **Auditoria**: `auth.login` (com IP), `auth.blocked` (brute-force) e `auth.logout` são gravados na `AuditLog`.

**Precauções:**
- Senha e TOTP **nunca** são logados nem retornados.
- O e-mail é normalizado (trim + lowercase) e validado por Zod no cadastro.
- Recuperação de senha usa **token de uso único com validade de 1h**.

---

## 4. Autorização / RBAC (`src/proxy.ts`, `src/lib/session.ts`)

Dupla camada de controle de acesso:

- **Middleware** (`proxy.ts`, roda na borda): `/admin/*` → **404** se não for ADMIN (não revela a existência do painel); `/conta/*` e `/checkout/*` → exigem login.
- **Por rota** (`requireAdmin` / `requireUser`): cada endpoint valida a sessão do lado do servidor. Cliente tentando rota admin → **403**; anônimo → **401**.
- **IDOR**: recursos são sempre filtrados por dono (`where: { id, userId }`). Pedido/endereço/reembolso de outro usuário → **404**.
- **Mass-assignment**: cadastro ignora `role` enviado pelo cliente → sempre nasce `CUSTOMER`.

### Sessão de administrador com tempo de vida limitado
O "cockpit" admin não pode ter sessão eterna. Ao logar, grava-se `loginAt` no token; passadas **`ADMIN_SESSION_MAX_HOURS`** (padrão **8h**), o middleware redireciona `/admin` → `/entrar?expirado=admin` e o `requireAdmin` bloqueia as APIs com **401**. Clientes da loja **não** são afetados. Configurável por env (`src/lib/admin-session.ts`).

---

## 5. Sessão, cookies e armazenamento de token

**Onde o token fica:** exclusivamente em **cookie `HttpOnly`** — o JavaScript **não consegue lê-lo**, tornando-o imune a roubo por XSS.

| Propriedade do cookie | Valor | Por quê |
|---|---|---|
| `HttpOnly` | sim | JS não acessa → imune a exfiltração por XSS |
| `SameSite` | `Lax` | mitiga CSRF (não é enviado em POST cross-site) |
| `Secure` | sim (produção HTTPS) | não trafega em HTTP puro |
| conteúdo | **JWT cifrado (JWE)** | adulterar o cookie invalida a sessão |

**Precauções:**
- **Zero uso de `localStorage`/`sessionStorage`** para tokens (verificado por busca no código). Optamos por cookie `HttpOnly`, que é **mais seguro** contra XSS do que qualquer storage acessível por JS.
- O endpoint `/api/auth/session` retorna **apenas** `{ user: {...}, expires }` — **nunca** o token bruto.
- Painel admin trafega **só via HTTPS** (HSTS + cookie `Secure`).

---

## 6. Senhas e criptografia (Fase 3)

- **Em repouso (senha):** `bcrypt` com salt. Proibidos e ausentes: texto puro, MD5, SHA1.
- **Em trânsito:** HTTPS obrigatório em produção (Caddy) + **HSTS** (`Strict-Transport-Security`) forçando o navegador a só usar TLS.
- **Sessão:** JWT **cifrado (JWE)** — não é um JWT assinado legível, é criptografado.
- **Mascaramento:** nenhuma senha, token, cartão ou chave é exibido ou logado. Os `detail` da auditoria contêm só metadados (nome, código, status, e-mail alvo de brute-force).
- **Pendência opcional:** cifrar o `twoFactorSecret` em repouso (hoje em texto no banco, padrão da maioria; melhoria via KMS).

---

## 7. Validação de entrada e proteção contra injeção (Fase 4)

**Regra de ouro: o servidor nunca confia no front-end.** Todo endpoint com corpo faz `SCHEMA.parse(await req.json())` com Zod. Schemas centralizados em `src/lib/validations.ts`.

| Vetor | Proteção |
|---|---|
| **SQL Injection** | Prisma parametriza tudo; nenhum `$queryRawUnsafe`/`$executeRawUnsafe`; sem concatenação de SQL. |
| **NoSQL Injection** | Zod rejeita objetos onde espera string (ex.: `{$ne:null}` no login → 400). |
| **XSS (refletido/armazenado/DOM)** | React escapa a saída; sem `dangerouslySetInnerHTML`; SVG proibido em upload. |
| **CSRF** | Cookie `SameSite=Lax` + token CSRF do NextAuth. |
| **SSRF** | Nenhuma requisição server-side usa URL controlada pelo usuário (MP e Melhor Envio são hosts fixos). |
| **Command / Path Injection** | Sem `exec`/`spawn` com input do usuário; uploads recebem **nome aleatório** (nunca o nome original). |

---

## 8. Uploads seguros (`src/services/storage.ts`)

- **Validação por magic bytes**: o tipo é confirmado pela **assinatura binária** do arquivo, não pelo `Content-Type` (que é falsificável).
- **Whitelist**: só JPG, PNG, WEBP, GIF. **SVG bloqueado** (pode conter script → XSS armazenado). PHP/JS/EXE rejeitados mesmo disfarçados de imagem.
- **Nome aleatório** (`crypto.randomBytes`) → previne path traversal e colisão.
- **Limite de 5 MB** e rejeição de arquivo vazio.
- Header `X-Content-Type-Options: nosniff` na pasta de uploads.

---

## 9. Integridade das regras de negócio

O cliente pode adulterar qualquer valor no navegador — por isso **tudo é recalculado no servidor**:

- **Preço**: checkout e PDV somam o subtotal a partir dos **preços do banco**; o valor enviado pelo cliente é ignorado (testado: injetar `subtotal:1` não muda o total).
- **Frete**: recotado no servidor (Melhor Envio) no momento do pedido.
- **Cupom**: revalidado no servidor (existência, validade, mínimo, limite de uso).
- **Estoque**: baixa **atômica** (`updateMany` com `stock >= qty`) evita venda de item esgotado (oversell), tanto no checkout quanto no PDV.

---

## 10. Segurança de APIs (Fase 5)

- **Rate limiting** por IP/usuário/e-mail (login, cadastro, checkout, reembolso). O IP real é lido à prova de spoofing (`X-Forwarded-For` à direita, `TRUSTED_PROXY_HOPS`).
- **CORS**: same-origin por padrão do Next — **sem** `Access-Control-Allow-Origin: *`.
- **Tratamento de erros** (`src/lib/api-helpers.ts`): handler central converte exceções em respostas genéricas. **Nunca** expõe stack trace, erro de SQL, caminho interno ou versão. Testado: JSON malformado → `500 {"error":"Erro interno do servidor"}`.
- **Erros do Prisma** conhecidos (unique/FK/not-found) viram 4xx amigáveis, sem vazar detalhes.

---

## 11. Segredos e variáveis de ambiente (Fase 6)

- **100% em `.env`**, que está no `.gitignore` e **não é versionado** (confirmado: `git ls-files` não encontra o `.env`).
- **Nenhum segredo hardcoded** no código (verificado por busca).
- **Sem `NEXT_PUBLIC_` para dados sensíveis**: os segredos (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MELHOR_ENVIO_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `SMTP_PASS`, `DATABASE_URL`, `SENTRY_DSN`) **não têm** o prefixo → o Next nunca os injeta no bundle do cliente. Sobra apenas `NEXT_PUBLIC_APP_URL` (o domínio público, não-sensível).
- **Gestão no deploy**: as variáveis devem ser configuradas **no serviço de hospedagem** (VPS `.env` ou painel de env), **não no repositório**.

---

## 12. Cabeçalhos HTTP (Fase 8) — `next.config.ts`

Todos presentes em todas as rotas:

| Cabeçalho | Valor | Protege contra |
|---|---|---|
| `Content-Security-Policy` | `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` | clickjacking, injeção de base/objeto |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | downgrade para HTTP |
| `X-Frame-Options` | `DENY` | clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | vazamento de URL |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | uso indevido de APIs do navegador |

---

## 13. Dependências (Fase 6)

`npm audit` executado; **`npm audit fix`** aplicou patches seguros (sem breaking):

- ✅ **`next-auth` 4.24.14 → 4.24.15** — corrige CVE **crítica** (bypass de homóglifo no e-mail).
- ✅ **`uuid` → 11.1.1**, **`postcss` → 8.5.25**, **`next` 16.2.10 → 16.2.12**.
- ⚠️ **3 CVEs residuais (high) — não-exploráveis nesta configuração:**
  - **`sharp`** (libvips): **não é usado em runtime** (`next.config` usa `images.unoptimized`).
  - **`postcss`** interno do Next: XSS só ao processar CSS **não-confiável**; a app só processa CSS próprio em build.
  - Corrigi-las exigiria `npm audit fix --force`, que bumparia o Next para *preview* e arriscaria quebrar a app → **não aplicado**. **Recomendação:** atualizar o Next quando sair release estável com as deps corrigidas.

---

## 14. Monitoramento, logging e auditoria (Fase 7)

- **Trilha de auditoria** (`AuditLog`): registra **quem, o quê, quando e o IP** de ações sensíveis — criar/editar produto, cupom, frete, status de pedido, venda no balcão (PDV), resolução de reembolso — e de **autenticação** (`auth.login`, `auth.logout`, `auth.blocked`).
- **Detecção de brute-force**: `auth.blocked` é gravado ao estourar o rate limit, com IP e e-mail alvo → base pronta para alertas.
- **Sentry** (`src/instrumentation.ts`): monitoramento de erros **no servidor**, capturando exceções do handler central de API e do **webhook de pagamento** (os mais críticos). Ativado só com `SENTRY_DSN` (sem DSN = no-op). `sendDefaultPii: false` (não coleta IP/cookies do usuário). O DSN é de servidor (sem `NEXT_PUBLIC_`).
- **Uptime** (`/api/health`): responde `200 {status:"ok"}` (app + banco no ar) ou `503` (banco caiu) → monitorável pelo UptimeRobot com alerta por e-mail/Telegram.

---

## 15. Backup e recuperação (Fase 9) — `DEPLOY.md`

- **Backup diário** via cron: `pg_dump` do PostgreSQL + `tar` da pasta `public/uploads`, com retenção de 14 dias.
- **Procedimento de restauração** (disaster recovery) documentado — recomenda-se testar periodicamente numa base de staging.

---

## 16. Infraestrutura e rede — `DEPLOY.md §8`

- **HTTPS** automático via **Caddy** (proxy reverso, SSL Let's Encrypt, renovação automática, redirect HTTP→HTTPS).
- **Firewall `ufw`**: libera só 22 (SSH), 80 e 443. Todo o resto bloqueado.
- **Banco isolado**: PostgreSQL escuta apenas `localhost`; a porta 5432 nunca é exposta.
- **`fail2ban` + `unattended-upgrades`**: bane IPs após falhas de SSH e aplica patches de segurança do SO automaticamente.
- **Cloudflare** (recomendado): WAF + anti-DDoS de borda.
- **`TRUSTED_PROXY_HOPS=1`**: garante que o rate-limit use o IP real do visitante (anexado pelo Caddy).

---

## 17. Pentest (Fase 10) — evidências

Testes automatizados reproduzindo um atacante real. Todos passaram:

| Vetor testado | Resultado |
|---|---|
| SQL Injection (login `' OR '1'='1`) | rejeitado ✅ |
| NoSQL Injection (`{$ne:null}`) | rejeitado (Zod) ✅ |
| XSS armazenado via upload de SVG | bloqueado (400) ✅ |
| Broken Access Control — `/api/admin/*` anônimo / cliente | 401 / 403 ✅ |
| IDOR — pedido/reembolso de outro cliente | 404 ✅ |
| Escalada de privilégio (cadastro com `role:ADMIN`) | ignorado → CUSTOMER ✅ |
| Brute force de login | bloqueado + auditado ✅ |
| Bypass de rate-limit via `X-Forwarded-For` | corrigido (lê IP real) ✅ |
| Adulteração de cookie/JWT | sessão inválida ✅ |
| Integridade de preço/cupom (checkout + PDV) | recalculado no servidor ✅ |
| Path traversal em upload | nome aleatório → sem traversal ✅ |
| SSRF | sem URL controlada pelo usuário ✅ |
| Vazamento de erro interno | 500 genérico, sem stack trace ✅ |
| Timeout de sessão admin | expira em 8h → força re-login ✅ |

---

## 18. Vulnerabilidades encontradas e corrigidas (histórico)

| # | Vulnerabilidade | Severidade | Correção |
|---|---|---|---|
| 1 | XSS armazenado via upload de SVG | 🟠 Média-Alta | Validação por magic bytes + SVG removido + `nosniff` |
| 2 | Cabeçalhos de segurança ausentes | 🟡 Média | CSP/HSTS/X-Frame/nosniff/Referrer/Permissions no `next.config` |
| 3 | Bypass de rate-limit via `X-Forwarded-For` (`getClientIp`) | 🟡 Média | Lê o IP real (à direita do XFF) |
| 4 | Mesmo bug de XFF duplicado no login (`authorize`) | 🟡 Média | Centralizado em `clientIpFromForwardedFor()` |
| 5 | `next-auth` ≤4.24.14 — CVE de homóglifo no e-mail | 🔴 Crítica | Atualizado para 4.24.15 |
| 6 | `uuid` <11.1.1 — CVE de bounds check | 🟡 Moderada | Atualizado para 11.1.1 |
| 7 | Sem trilha de eventos de autenticação | 🟡 Média | `auth.login`/`logout`/`blocked` na auditoria |
| 8 | Sessão de admin sem limite de tempo | 🟡 Média | Expiração absoluta de 8h (configurável) |

---

## 19. Checklist final

**✅ Corrigido / Implementado**
- [x] SQLi, NoSQLi, XSS, CSRF, SSRF, Path/Command Injection — mitigados
- [x] Upload seguro (magic bytes, sem SVG/executáveis, nome aleatório, 5 MB)
- [x] Cabeçalhos de segurança completos (CSP, HSTS, X-Frame, nosniff, Referrer, Permissions)
- [x] Senhas com bcrypt; sessão em JWT cifrado (JWE)
- [x] Cookies HttpOnly + SameSite + Secure; zero token em localStorage/sessionStorage
- [x] RBAC (middleware + por rota); IDOR protegido; mass-assignment bloqueado
- [x] 2FA (TOTP) disponível para admin
- [x] Rate-limit por IP/usuário/e-mail com IP real (à prova de spoofing)
- [x] Integridade de preço/cupom/estoque server-side (checkout + PDV)
- [x] Timeout de sessão de admin (8h, configurável)
- [x] Segredos fora do código e do bundle (`.env` gitignored; sem `NEXT_PUBLIC_` sensível)
- [x] Tratamento de erros sem vazamento; CORS same-origin
- [x] Auditoria completa + eventos de autenticação
- [x] Monitoramento de erros (Sentry) e de uptime (`/api/health`)
- [x] Dependências: CVE crítica e moderada corrigidas
- [x] Backup diário + procedimento de restauração documentados
- [x] Hardening de servidor documentado (firewall, banco isolado, fail2ban, Cloudflare)

**⏳ Pendências (infraestrutura ou decisão do lojista)**
- [ ] Definir no serviço de hospedagem: `NEXTAUTH_SECRET` novo, `MERCADOPAGO_WEBHOOK_SECRET`, credenciais de produção
- [ ] Ativar HTTPS (Caddy) + Cloudflare (WAF/DDoS) + `ufw` no VPS (guia pronto no DEPLOY.md)
- [ ] Configurar `SENTRY_DSN` e o monitor do UptimeRobot em `/api/health`
- [ ] Atualizar o Next quando houver release estável (resolve as 3 CVEs de dependência residuais)
- [ ] (Opcional) Tornar o **2FA obrigatório** para o admin
- [ ] (Opcional) Cifrar `twoFactorSecret` em repouso (KMS)
- [ ] (Opcional) Versionar APIs em `/api/v1`

---

## 20. Mapa de arquivos de segurança

| Área | Arquivo(s) |
|---|---|
| Autenticação + 2FA + auditoria de login | `src/lib/auth.ts`, `src/lib/totp.ts` |
| Autorização / RBAC | `src/proxy.ts`, `src/lib/session.ts` |
| Timeout de sessão admin | `src/lib/admin-session.ts` |
| Validação de entrada (Zod) | `src/lib/validations.ts` |
| Rate limiting + IP real | `src/lib/rate-limit.ts` |
| Tratamento de erros | `src/lib/api-helpers.ts` |
| Upload seguro | `src/services/storage.ts` |
| Cabeçalhos de segurança | `next.config.ts` |
| Trilha de auditoria | `src/lib/audit.ts` |
| Monitoramento de erros (Sentry) | `src/instrumentation.ts` |
| Health check (uptime) | `src/app/api/health/route.ts` |
| Integridade de preço/estoque | `src/services/orders.ts`, `src/services/store-sale.ts` |
| Deploy + hardening + backup | `DEPLOY.md` |
