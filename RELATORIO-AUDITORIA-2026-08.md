# 🔒 Relatório de Auditoria — Qualidade, Robustez & Segurança

**Aplicação:** E-commerce Gata Fit · **Data:** 01/08/2026 · **Escopo:** aplicação inteira (pré-produção)
**Método:** revisão estática (dev sênior / arquiteto), pentest OWASP, fuzzing ativo de endpoints, testes de integração no banco real. Sem ações destrutivas em dados reais.

---

## Fase 1 — Mapeamento do sistema

| Item | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Route Handlers) |
| Linguagem | TypeScript 5 (strict) · React 19 |
| Banco | Prisma ORM — SQLite (dev) / PostgreSQL-ready (prod) |
| Autenticação | NextAuth v4 (JWT/JWE, credenciais + Google), bcrypt(12), 2FA TOTP (otplib) |
| Pagamento | Mercado Pago Checkout Pro (SDK v2) + webhook HMAC |
| Frete/Etiqueta | Melhor Envio (cotação + emissão de etiqueta), Correios CWS, tabela interna |
| Notificações | E-mail (nodemailer/SMTP), WhatsApp (provedor REST agnóstico) |
| Observabilidade | Sentry (gated), `/api/health`, `AuditLog` |

**Fluxos principais:** navegação/catálogo → carrinho → checkout (MP) → webhook → pedido → etiqueta/rastreio → entrega; conta (perfil, endereços, 2FA, reembolso); admin (produtos, pedidos, PDV, cupons, estoque, relatórios).
**Dependências críticas:** Mercado Pago, Melhor Envio, banco. **Áreas de maior risco:** checkout/pagamento (dinheiro), autorização admin, upload de imagem, cupons.

---

## Fase 2 — Superfície de rotas (resumo de proteção)

| Grupo | Proteção | Observação |
|---|---|---|
| `/api/admin/**` (14 rotas) | `requireAdmin()` em **todas** + auditoria | verificado 1 a 1 |
| `/api/account/**` (8 rotas) | `requireUser()` + escopo por `userId` | sem IDOR |
| `/api/cart`, `/api/coupons/validate`, `/api/shipping/quote` | público (carrinho por cookie HttpOnly) | cupom agora com rate limit |
| `/api/checkout`, `/api/reviews`, `/api/wishlist` | `requireUser()` + rate limit | preço recomputado no servidor |
| `/api/webhooks/mercadopago` | HMAC + idempotência + fonte de verdade | não confia no body |
| `/api/cron/tracking` | `CRON_SECRET` (timing-safe) | desligado sem segredo |
| `/admin/**` (páginas) | middleware: 404 p/ não-admin + timeout de sessão | não revela o painel |

Sem rotas órfãs/duplicadas/desprotegidas encontradas. O middleware cobre **páginas**; as rotas de API se protegem individualmente (confirmado).

---

## Resumo Executivo

| Métrica | Qtd |
|---|---|
| 🐞 Bugs/defeitos encontrados | 4 |
| 🔓 Vulnerabilidades | 2 (1 média segurança + 1 média integridade) |
| 🔴 Críticos | **0** |
| 🟠 Altos | **0** |
| 🟡 Médios | **2** (corrigidos) |
| 🟢 Baixos | **2** (corrigidos) |
| ⚪ Riscos aceitos / notas | 5 (documentados) |

**Todos os achados foram corrigidos e reverificados. 0 críticos e 0 altos remanescentes.**

---

## Tabela de achados (corrigidos)

| # | Sev. | Local | Impacto | Prob. | Correção aplicada |
|---|---|---|---|---|---|
| 1 | 🟡 Média | `services/coupons.ts` + `services/orders.ts` (checkout) | **Corrida de cupom:** dois checkouts simultâneos podiam ultrapassar `maxUses` (perda financeira) — `validateCoupon` roda antes da transação | Baixa (só sob concorrência real/Postgres) | Incremento **atômico** condicional (`updateMany where usedCount < maxUses`); 0 linhas → 409. Testado (4/4). |
| 2 | 🟡 Média | `api/coupons/validate` | **Enumeração/força-bruta de cupons** (endpoint público sem limite) → descobrir códigos válidos = dinheiro | Média | Rate limit `30/10min` por IP → 429. Testado. |
| 3 | 🟢 Baixa | `lib/api-helpers.ts` (`handler`) — afetava ~30 endpoints | **JSON malformado → HTTP 500** (SyntaxError não tratado): erro interno + ruído no Sentry por requisição inválida | Alta (trivial de disparar) | `handler` passa a mapear `SyntaxError` → **400**. Testado em 3 rotas. |
| 4 | 🟢 Baixa | `api/webhooks/mercadopago` | Pagamento inexistente (404) → **500 em loop** (MP reenvia notificação morta) | Baixa | `getPayment` 404 → reconhece (200, `ignored`) e marca processado; demais erros seguem 500 (retry). Testado. |

### Evidências (antes → depois)
```
JSON malformado:     500 "Erro interno"        →  400 "Requisição inválida (JSON malformado)"
Cupom (força-bruta): 200/200/200… (ilimitado)  →  400×30, depois 429
Cupom esgotado:      usedCount podia ir a N+1   →  409 "atingiu o limite"; usedCount travado no limite
Webhook 404:         500 (retry infinito)       →  200 {received, ignored:"payment_not_found"}
```

---

## Fases 3–12 — Verificado e **seguro** (sem ação necessária)

**Autorização (Fase 6):** todas as rotas admin exigem ADMIN; troca de ID na URL (pedidos, endereços, reembolsos) barrada por escopo `userId`; escalada de privilégio impossível — `register`/`profile` **não** aceitam `role`; middleware 404 para não-admin + expiração de sessão admin.

**Pentest OWASP (Fase 5):**
- **SQL/NoSQL Injection:** Prisma parametrizado (único raw é `SELECT 1` do health); Zod rejeita type-confusion (`{$ne:…}`, arrays) → 400. Testado por fuzzing.
- **XSS (refletido/armazenado/DOM):** React escapa saída; feed XML escapa entidades; sem `dangerouslySetInnerHTML` com dado de usuário.
- **CSRF:** mutações via `fetch` same-origin + cookies `SameSite=Lax`/HttpOnly.
- **SSRF:** URLs de saída (Melhor Envio) vêm da API oficial, não do cliente.
- **Upload (Fase 9):** valida **magic bytes** (não o Content-Type), **rejeita SVG**, nome aleatório (anti path-traversal), teto 5 MB, header `nosniff`; só admin.
- **Auth bypass / brute force (Fase 4):** bcrypt(12); rate limit conta só falhas (5/e-mail, 20/IP); 2FA TOTP; tokens de reset **uso único + expiração**; desativar 2FA exige senha.
- **Clickjacking/headers (Fase 7):** `X-Frame-Options: DENY`, CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), HSTS, `nosniff`, Referrer/Permissions-Policy.

**Pagamento & regras de negócio (Fase 3–4):** webhook com HMAC + idempotência + status sempre consultado na API do MP + sem regressão de estado; checkout **recomputa** preço/frete/cupom no servidor (nunca confia no cliente); `simulate-payment` bloqueado (404) quando MP real está configurado; PDV usa preços do banco e valida troco.

**Banco (Fase 8):** baixa de estoque **atômica** (`updateMany where stock ≥ qty`) — sem overselling nem corrida; índices em `Order(userId,status,createdAt)`, `WebhookEvent` unique; soft-delete de produto vendido (preserva histórico); FKs com `onDelete` coerente.

**Etiqueta Melhor Envio (recém-adicionada):** token gated (422 sem escopos), admin + auditoria + rate limit, **máquina de estados resumível** (retry não recobra saldo), PDF via redirect protegido.

**Robustez (Fase 12):** valores negativos/overflow barrados por Zod (`int().min()`, `max`); quantidades limitadas (99/999); payloads grandes rejeitados por validação.

---

## Fase 10 — Dependências (riscos aceitos)

`npm audit` reporta **3 vulnerabilidades altas**, todas **internas ao Next.js** e **não exploráveis** nesta configuração:

| Pacote | CVE/aviso | Por que não é explorável | Ação |
|---|---|---|---|
| `postcss` (<8.5.17) | GHSA-qx2v/6g55/r28c | usado só no **build** sobre CSS confiável (não processa input de usuário) | aguardar bump interno do Next |
| `sharp` (<0.35) | GHSA-f88m (libvips) | `images.unoptimized: true` → sharp **não** processa imagens em runtime | aguardar bump interno do Next |

⚠️ `npm audit fix --force` **rebaixaria para `next@9`** (quebra total) — **não aplicar**. A correção correta é o Next atualizar suas dependências internas.

---

## Notas / melhorias futuras (baixa prioridade)

- **CPF** (`profileSchema`) não valida dígito verificador — se inválido, o Melhor Envio pode recusar a etiqueta (o erro aparece no painel). Qualidade de dado, não segurança.
- Sem teto de endereços/itens de carrinho por usuário — DoS de armazenamento **atrás de login**, impacto mínimo.
- Rate limiter em memória é **por instância** — para múltiplas instâncias, migrar para Redis/Upstash (interface já preparada).
- Cron de rastreio processa até 300 envios sequencialmente — adequado à escala atual.

---

## Score Geral

| Dimensão | Nota |
|---|---|
| 🔐 Segurança | **9.2 / 10** |
| ⚡ Performance | **8.5 / 10** |
| 🏛️ Arquitetura | **9.2 / 10** |
| 🧹 Qualidade de código | **9.2 / 10** |
| 💪 Robustez | **9.0 / 10** |

### ⭐ Nota final: **9.1 / 10**

Aplicação **madura e pronta para produção**. Controles de segurança de nível profissional (authZ consistente, integridade de pagamento, upload endurecido, 2FA, auditoria, headers). Os achados desta rodada eram de severidade baixa/média e foram **todos corrigidos e reverificados**; não restam problemas críticos ou altos. Antes do go-live, apenas concluir a configuração operacional (segredos no host, Postgres, backups, WAF/limite de body no proxy reverso, monitores).

---

## Verificação pós-correção

- `tsc --noEmit` — **0 erros**
- Suíte de etiqueta/notificação — **22/22**
- Corrida de cupom (banco real) — **4/4**
- Fuzzing HTTP (33 casos) — sem 500 remanescentes; status corretos
- Servidor de dev — sem erros no console/logs após as mudanças
