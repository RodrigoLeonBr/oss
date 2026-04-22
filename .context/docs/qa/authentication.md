---
slug: authentication
category: features
generatedAt: 2026-04-21T00:00:00.000Z
relevantFiles:
  - frontend/src/contexts/AuthContext.tsx
  - frontend/.env.development
  - src/service/AuthService.js
  - src/service/TokenService.js
  - src/config/passport.js
  - src/middlewares/auth.js
  - src/middlewares/rbac.js
---

# Como funciona a autenticação?

## Fluxo de Autenticação

### 1. Login (Backend)

`POST /api/auth/login` com body `{ email, password }`:

1. `AuthController.login` chama `AuthService.loginWithEmailPassword(email, password)`
2. `AuthService` busca `Usuario.findOne({ where: { email, ativo: 1 } })` em `tb_usuarios`
3. Compara `password` com `user.senha_hash` via `bcrypt.compare`
4. Em caso de sucesso, chama `TokenService.generateAuthTokens(user)`
5. `TokenService` usa `user.usuario_id` (não `uuid`) como JWT `sub` e salva o token na tabela `tokens`
6. Resposta: `{ data: { usuario_id, nome, email, perfil, ... }, tokens: { access: { token }, refresh: { token } } }`

### 2. Login (Frontend)

`AuthContext.login(email, password)` faz `fetch('/api/auth/login', { method: 'POST', ... })`:

```typescript
const body = await res.json()
const user: Usuario = body.data
const token: string = body.tokens.access.token
setAuth({ user, token, isAuthenticated: true })
```

O token é persistido em `localStorage` (chave `oss_auth`) e usado em todas as requisições via `useApi`.

### 3. Auto-Login em DEV

O `AuthContext` tem um `useEffect` que dispara no mount em modo DEV:

```typescript
useEffect(() => {
  if (!import.meta.env.DEV) return
  if (auth.isAuthenticated) return
  const devEmail = import.meta.env.VITE_DEV_EMAIL
  const devPassword = import.meta.env.VITE_DEV_PASSWORD
  if (!devEmail || !devPassword) return
  login(devEmail, devPassword).catch(err => console.warn('[DEV] Auto-login failed:', err.message))
}, [])
```

Credenciais em `frontend/.env.development`:
```
VITE_DEV_EMAIL=admin@americana.sp.gov.br
VITE_DEV_PASSWORD=Oss@2026
```

### 4. Verificação de Token (Backend)

Cada requisição autenticada passa pelo middleware `auth()` (Passport JWT):

1. Extrai Bearer token do header `Authorization`
2. Verifica assinatura JWT e valida `payload.type === 'access'`
3. Busca token na tabela `tokens` (ou Redis cache) para confirmar que não foi revogado
4. Carrega `Usuario.findOne({ where: { usuario_id: payload.sub, ativo: 1 } })` de `tb_usuarios`
5. `req.user` = instância Sequelize de `Usuario` (tem `perfil` para RBAC)

### 5. RBAC

`authorize([...perfis])` middleware verifica `req.user.perfil`:

```javascript
// Exemplo de rota protegida:
router.get('/', auth(), authorize([PERFIS.ADMIN, PERFIS.GESTOR_SMS]), controller.listar)
```

Perfis disponíveis: `admin`, `gestor_sms`, `auditora`, `cms`, `contratada`

No frontend, `ProtectedRoute` verifica `hasPermission(allowedPerfis)`:

```typescript
const hasPermission = (perfis: Perfil[]) => perfis.includes(auth.user?.perfil)
```

## Tabelas Envolvidas

| Tabela | Propósito |
|--------|-----------|
| `tb_usuarios` | Usuários da aplicação (`usuario_id`, `email`, `senha_hash`, `perfil`, `ativo`) |
| `tokens` | Tokens JWT emitidos (`token`, `user_uuid` = `usuario_id`, `type`, `expires`, `blacklisted`) |

> **Nota**: A tabela `users` (boilerplate) existe mas não é mais usada para autenticação. Todo o fluxo usa `tb_usuarios`.

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/service/AuthService.js` | Login com `tb_usuarios` e `senha_hash` |
| `src/service/TokenService.js` | Geração/verificação JWT com `usuario_id` |
| `src/config/passport.js` | Estratégia JWT — carrega `Usuario` por `payload.sub` |
| `src/middlewares/auth.js` | Middleware `auth()` — invoca Passport |
| `src/middlewares/rbac.js` | Middleware `authorize()` — verifica `req.user.perfil` |
| `frontend/src/contexts/AuthContext.tsx` | Estado de auth, login real, auto-login DEV |
| `frontend/.env.development` | Credenciais DEV (não commitado) |
