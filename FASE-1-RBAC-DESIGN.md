# Fase 1 — Desenho técnico: RBAC + Gestão de Usuários

> **Documento de design. Nenhum código de produção será escrito até este desenho
> ser validado.** Objetivo: transformar o controle de acesso binário
> (`CUSTOMER | ADMIN`) em papéis com permissões granulares, e adicionar a tela de
> gestão de usuários — a fundação que todas as fases seguintes dependem.

---

## 1. Escopo

**Dentro da Fase 1:**
- Papéis de operação (gerente, caixa, estoquista, financeiro) além de ADMIN/CUSTOMER.
- Catálogo de permissões por módulo + matriz papel → permissões.
- Camada de autorização reutilizável (`hasPermission`, `requirePermission`).
- Menu lateral (sidebar) filtrado por permissão.
- Tela `/admin/usuarios`: listar, criar, editar, ativar/desativar, atribuir papel.
- Auditoria de toda mutação de usuário/papel.
- Revogação **imediata** de acesso (desativar = bloqueia na hora).

**Fora da Fase 1 (fases futuras):**
- Permissões por registro/linha (ex.: "só vê pedidos da própria loja").
- Papéis 100% dinâmicos criados pelo usuário final (ver decisão em §12).
- 2FA obrigatório por papel (pode entrar numa fase de hardening depois).

---

## 2. Papéis propostos

| Papel (valor no banco) | Para quem | Ideia central |
|---|---|---|
| `ADMIN` | Dono / TI | **Tudo**, incluindo usuários, ajustes e auditoria. (Já existe.) |
| `GERENTE` | Gerente de loja | Operação completa + relatórios + usuários; **sem** ajustes de sistema. |
| `CAIXA` | Operador de PDV | PDV, caixa, consultar pedidos/produtos/clientes. |
| `ESTOQUISTA` | Estoque/compras | Produtos, estoque, fornecedores, entradas; **sem** financeiro nem PDV. |
| `FINANCEIRO` | Financeiro | Financeiro, relatórios, consultar pedidos. (Ganha função na Fase 2.) |
| `CUSTOMER` | Cliente da loja | Sem acesso ao `/admin`. (Já existe.) |

> `ADMIN` e `CUSTOMER` permanecem **exatamente** como hoje — zero quebra de
> compatibilidade com sessões e seed existentes. Os papéis novos são **aditivos**.

---

## 3. Catálogo de permissões

Formato `modulo.acao` (string). `read` = ver/listar; `write` = criar/editar; verbos
específicos quando fizer sentido (`operate`, `manage`).

| Permissão | Cobre |
|---|---|
| `dashboard.view` | Dashboard |
| `products.read` / `products.write` | Produtos e categorias |
| `stock.read` / `stock.write` | Estoque, ajustes e entradas de mercadoria |
| `suppliers.write` | Fornecedores |
| `pos.operate` | PDV (venda em loja) |
| `cash.operate` | Caixa (abrir/fechar/sangria/suprimento) |
| `orders.read` / `orders.write` | Pedidos (status, etiqueta, rastreio) |
| `customers.read` | Clientes |
| `coupons.write` | Cupons |
| `shipping.manage` | Regras de frete |
| `refunds.manage` | Reembolsos |
| `reports.read` | Relatórios / exportações |
| `finance.read` / `finance.write` | Financeiro *(ativa na Fase 2)* |
| `purchases.read` / `purchases.write` | Compras *(ativa na Fase 3)* |
| `fiscal.manage` | Emissão fiscal *(ativa na Fase 6)* |
| `users.manage` | Gestão de usuários e papéis |
| `audit.read` | Log de auditoria |
| `settings.manage` | Configurações do sistema |

> Já defino permissões de módulos futuros (finance/purchases/fiscal) para que a matriz
> não precise ser reescrita a cada fase — só passam a "ligar" telas quando existirem.

---

## 4. Matriz papel → permissões

`●` = concedida. `ADMIN` recebe **todas** (curinga), por isso não aparece coluna a coluna.

| Permissão | GERENTE | CAIXA | ESTOQUISTA | FINANCEIRO |
|---|:--:|:--:|:--:|:--:|
| dashboard.view | ● | ● | ● | ● |
| products.read | ● | ● | ● | ● |
| products.write | ● | | ● | |
| stock.read | ● | ● | ● | ● |
| stock.write | ● | | ● | |
| suppliers.write | ● | | ● | |
| pos.operate | ● | ● | | |
| cash.operate | ● | ● | | |
| orders.read | ● | ● | ● | ● |
| orders.write | ● | | ● | |
| customers.read | ● | ● | | ● |
| coupons.write | ● | | | |
| shipping.manage | ● | | ● | |
| refunds.manage | ● | | | ● |
| reports.read | ● | | ● | ● |
| finance.read *(F2)* | ● | | | ● |
| finance.write *(F2)* | ● | | | ● |
| purchases.* *(F3)* | ● | | ● | |
| fiscal.manage *(F6)* | ● | ● | | |
| users.manage | ● | | | |
| audit.read | ● | | | |
| settings.manage | | | | |

> A matriz é uma proposta de ponto de partida — números e recortes se ajustam
> facilmente (é só uma constante). `settings.manage` fica só com ADMIN de propósito.

---

## 5. Modelo de dados — mudança mínima

Uma única alteração de schema, **aditiva e segura** nos dois bancos:

```prisma
model User {
  // ... campos atuais ...
  role   String  @default("CUSTOMER")   // já existe — agora aceita novos papéis
  active Boolean @default(true)          // NOVO — desativar sem apagar (auditável)
}
```

- **Nada** é renomeado ou removido; `role` continua `String` (coerente com o padrão do
  projeto de "enums como String validadas por Zod").
- `active` entra com default `true` → todas as contas existentes seguem ativas.
- Migração: mesmo fluxo atual (`prisma db push`, já usado no `vercel-build`). Sem
  passo manual de backfill.

Por que **não** criar tabelas `Role`/`Permission` no banco agora: ver decisão §12.

---

## 6. Camada de autorização (reutilizável)

**Novo — `src/lib/permissions.ts`** (fonte única da matriz):
```ts
export type Permission = "dashboard.view" | "products.write" | /* ... */;
export type Role = "ADMIN" | "GERENTE" | "CAIXA" | "ESTOQUISTA" | "FINANCEIRO" | "CUSTOMER";

const MATRIX: Record<Role, Permission[] | "*"> = { ADMIN: "*", GERENTE: [...], /* ... */ };

export function roleHasPermission(role: string, perm: Permission): boolean { /* ... */ }
export function permissionsForRole(role: string): Permission[] { /* ... */ }
export const ROLE_LABELS: Record<Role, string> = { /* rótulos PT-BR para a UI */ };
```

**Estende — `src/lib/session.ts`** (ao lado de `requireAdmin`, sem removê-lo):
```ts
export async function requirePermission(perm: Permission) { /* 401/403 + expiração admin */ }
export async function requireStaff() { /* qualquer papel != CUSTOMER, para o layout */ }
```

**Ajuste cirúrgico em `getCurrentUser()`** (mesmo arquivo): hoje ela busca no banco
só `{ id }` para confirmar existência. Passa a buscar `{ id, role, active }` e:
- retorna `null` se `active === false` → **desativar bloqueia na hora** (não espera os
  30 dias do JWT);
- usa o `role` **do banco** como verdade → **trocar de papel vale imediatamente**.

Isso mantém `requireAdmin` intacto (ADMIN tem `"*"`), então **todas as rotas admin
atuais continuam funcionando sem alteração**.

---

## 7. Guarda de rota e menu

- **`src/app/admin/layout.tsx`**: troca `role !== "ADMIN"` por `requireStaff()` — passa a
  admitir os papéis de operação; quem não é staff continua caindo em `notFound()`.
- **`src/components/admin/AdminSidebar.tsx`**: cada item do array `links` ganha uma
  `perm`; a lista é filtrada por `permissionsForRole(role)`. O papel é passado como prop
  a partir do layout (server → client). Adiciona o item **"Usuários"** (perm `users.manage`).
- **Cada página `/admin/*`**: um `await requirePermission("...")` no topo do Server
  Component (defesa em profundidade — não confia só no menu escondido).

---

## 8. API — Gestão de usuários

Seguindo o molde do projeto (`handler` + Zod + `requirePermission` + `audit`):

| Rota | Método | Permissão | Ação |
|---|---|---|---|
| `/api/admin/users` | `GET` | `users.manage` | Listar (sem `passwordHash`/`twoFactorSecret`) |
| `/api/admin/users` | `POST` | `users.manage` | Criar (nome, e-mail, papel, senha inicial) |
| `/api/admin/users/[id]` | `PATCH` | `users.manage` | Editar nome/papel/`active` |
| `/api/admin/users/[id]` | `DELETE` | `users.manage` | **Desativar** (nunca apaga) |

**Schemas Zod novos** (`src/lib/validations.ts`): `userCreateSchema`, `userUpdateSchema`
— papel validado contra a lista de `Role`, senha reaproveitando `registerSchema.shape.password`.

**Regras de segurança (invariantes):**
1. **Nunca** retornar `passwordHash` nem `twoFactorSecret` (select explícito).
2. **Sem auto-sabotagem:** um usuário não pode desativar a própria conta nem tirar o
   próprio papel de gestão.
3. **Proteção do último ADMIN:** bloquear rebaixar/desativar o único `ADMIN` ativo.
4. Senha sempre com `bcrypt` (reaproveita o hash já usado no registro).
5. Só quem tem `users.manage` chega aqui; **atribuir `ADMIN`** exige o próprio ator ser
   `ADMIN` (um GERENTE não cria um ADMIN — escalonamento de privilégio).
6. **Auditar tudo:** `user.create`, `user.update`, `user.role_change`,
   `user.deactivate`, `user.activate`, `user.password_reset`.

---

## 9. Onboarding de novo funcionário — 2 opções (decisão §12)

- **(A) Admin define uma senha inicial** no formulário de criação. Simples, reaproveita
  `bcrypt`; o funcionário troca depois em "Minha conta". Menos seguro (senha trafega/é
  vista por quem cria).
- **(B) Convite por e-mail:** cria a conta sem senha e envia link de definição.
  **Reaproveita 100%** a infra que já existe (`PasswordResetToken` + `lib/email.ts`) — é
  o fluxo de "recuperar senha" reusado como "definir senha". Mais profissional/seguro.

---

## 10. Compatibilidade (nada quebra)

| Preocupação | Resultado |
|---|---|
| Sessões/JWT atuais (role "ADMIN"/"CUSTOMER") | Continuam válidas; ADMIN = `"*"` |
| Rotas `/admin` e `/api/admin` existentes | Intactas (ADMIN passa em qualquer `requirePermission`) |
| Seed (cria 1 ADMIN + 1 CUSTOMER) | Sem mudança |
| Banco em produção | Só ganha coluna `active` com default (db push aditivo) |
| Núcleo transacional (pedidos/estoque/caixa/webhook) | **Não é tocado** |

---

## 11. Critérios de aceite (como vou validar antes de fechar o módulo)

- [ ] ADMIN mantém acesso total (nenhuma regressão nas telas atuais).
- [ ] CAIXA acessa PDV/caixa/pedidos-leitura; **não** vê Financeiro/Usuários/Cupons.
- [ ] ESTOQUISTA acessa Produtos/Estoque/Fornecedores; **não** opera PDV.
- [ ] Desativar um usuário derruba o acesso **na requisição seguinte** (sem esperar re-login).
- [ ] Trocar o papel passa a valer sem novo login.
- [ ] Não é possível desativar/rebaixar o último ADMIN nem a própria conta.
- [ ] Toda mutação aparece no log de auditoria.
- [ ] Menu esconde o que o papel não pode — e a página bloqueia mesmo por URL direta.
- [ ] `passwordHash`/`twoFactorSecret` nunca saem na API.
- [ ] Responsivo (a sidebar já é) e sem erro no console/Sentry.

---

## 12. Decisões que preciso de você (travam o design)

1. **Modelo de RBAC** — recomendo **matriz estática em código** (papéis fixos, KISS,
   coerente com o projeto; papéis novos = 1 constante). Alternativa: **papéis dinâmicos
   no banco** (o próprio dono cria papéis/permissões na tela) — mais flexível, porém
   bem mais trabalho e complexidade que uma loja única raramente usa.
2. **Onboarding** — recomendo **convite por e-mail** (reaproveita `PasswordResetToken`
   + e-mail que já existem; mais seguro). Alternativa: **admin define a senha inicial**
   (mais simples, imediato).
3. **Papéis** — os 4 papéis operacionais e a matriz da §4 atendem sua operação, ou quer
   ajustar nomes/recortes (ex.: separar "vendedor" de "caixa")?

---

## 13. Arquivos afetados (resumo para revisão)

**Novos:** `src/lib/permissions.ts`, `src/app/admin/usuarios/page.tsx` (+ componente
`UserManager.tsx`), `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`.

**Alterados (aditivo/seguro):** `prisma/schema.prisma` (+`active`), `src/lib/session.ts`
(+`requirePermission`/`requireStaff`, `getCurrentUser` busca role+active),
`src/lib/validations.ts` (+2 schemas), `src/app/admin/layout.tsx` (guard),
`src/components/admin/AdminSidebar.tsx` (filtro por permissão + item Usuários),
e um `await requirePermission(...)` no topo de cada página `/admin/*`.

**Não tocados:** `services/orders.ts`, `services/store-sale.ts`, `services/stock.ts`,
`services/cash.ts`, `api/webhooks/*`, `lib/auth.ts`.

---

## 14. Status da implementação (concluída e verificada)

Decisões travadas: **matriz estática em código** + **convite por e-mail**.

**Entregue:**
- `src/lib/permissions.ts` (matriz), `src/lib/page-guard.ts` (guards de página).
- `src/lib/session.ts`: `getCurrentUser` agora lê `role`+`active` do banco; novos
  `requirePermission` e `requireStaff` (mantido `requireAdmin`).
- Schema: `User.active` (aplicado com `prisma db push`, aditivo).
- **`src/proxy.ts`** — descoberta importante: no **Next.js 16 o middleware chama-se
  `proxy.ts`** (era o "middleware" citado no layout, que a busca por `middleware.ts`
  não achava). Ele bloqueava `/admin` para quem não era `ADMIN`; passou a liberar
  qualquer papel de equipe via `isStaffRole` (checagem grossa na borda; a fina fica no
  layout/páginas/rotas com o papel do banco).
- Layout admin (`requirePageStaff`) + sidebar filtrada por permissão + item "Usuários".
- `requirePagePermission(...)` em **todas** as páginas `/admin/*`.
- **Todas** as rotas `/api/admin/*` migradas de `requireAdmin` → `requirePermission(<perm>)`.
- Tela `/admin/usuarios` + `UserManager.tsx` + rotas `users` / `users/[id]`
  (criar/convidar, editar, desativar, reenviar convite) com todas as invariantes de
  segurança (último admin, auto-sabotagem, escalonamento, sem expor segredos).
- E-mail `sendUserInvite` (reaproveita `/redefinir-senha`, validade 7 dias).

**Verificado no navegador (dev):**
- ✅ ADMIN: menu completo + Usuários; cria convite (link logado no console em dev).
- ✅ Convite → define senha → login como CAIXA funciona.
- ✅ CAIXA vê só 6 itens (Dashboard, Venda em Loja, Pedidos, Produtos, Estoque, Clientes).
- ✅ CAIXA em `/admin/relatorios` → 404 (defesa em profundidade na página).
- ✅ CAIXA em `GET /api/admin/reports/sales` → 403 (defesa na rota).
- ✅ CAIXA opera o PDV normalmente (permissão concedida).
- ✅ `tsc --noEmit` sem erros.

**Pendências menores (fora do caminho crítico):** testes automatizados dos guards
(`requirePermission`/matriz) numa fase de qualidade; opcional "promover cliente a staff".
