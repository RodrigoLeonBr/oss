# DEV Auth Real — Usar Dados do BD em Desenvolvimento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o sistema de autenticação do boilerplate (`users` + token fake) para `tb_usuarios`, e atualizar o `AuthContext` para fazer login real via `POST /api/auth/login` em DEV, de forma que todas as chamadas de API usem um JWT válido e recebam dados reais do banco.

**Architecture:**
O projeto herdou um boilerplate Express com tabela `users` e autenticação própria. A OSS já tem sua tabela `tb_usuarios` com `perfil`, `senha_hash` e RBAC completo, mas a pilha de auth ainda aponta para a tabela boilerplate — gerando o gap: o frontend em DEV usa um token fake (base64) que o Passport rejeita com 401. A solução é fazer três cirurgias no backend (AuthService → Usuario, TokenService → usuario_id, passport → tb_usuarios) e atualizar o AuthContext para chamar `POST /api/auth/login` com credenciais reais do seed.

**Tech Stack:** Node.js/Express, Sequelize, Passport.js JWT, bcryptjs, React 18, TypeScript, Vite env vars (`VITE_DEV_*`)

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `src/service/AuthService.js` | Autenticar contra `tb_usuarios` em vez de `users` |
| Modify | `src/service/TokenService.js` | Usar `usuario_id` como `sub` do JWT em vez de `uuid` |
| Modify | `src/config/passport.js` | Carregar `Usuario` (tb_usuarios) em vez de `User` (users) |
| Create | `frontend/.env.development` | Credenciais DEV como variáveis Vite |
| Modify | `frontend/src/contexts/AuthContext.tsx` | Login real via API; remover `makeToken()` e mock lookup |

---

## Contexto Essencial (leia antes de implementar)

### Por que 3 arquivos no backend?

O fluxo de auth tem 3 etapas independentes:

```
POST /api/auth/login
  → AuthService.loginWithEmailPassword()    ← Task 1: muda para tb_usuarios
      → TokenService.generateAuthTokens()   ← Task 2: muda user.uuid → user.usuario_id
          → saveMultipleTokens()             (tokens table sem FK — OK)

GET /api/unidades (com Bearer token)
  → passport jwtVerify()                    ← Task 3: carrega Usuario, não User
      → req.user = Usuario (com perfil)
```

### Estrutura da resposta de login (atual e futura)

```json
{
  "status": true,
  "code": 200,
  "message": "Login Successful",
  "data": {
    "usuario_id": "aaaa0001-0001-0001-0001-000000000001",
    "nome": "Administrador Geral",
    "email": "admin@americana.sp.gov.br",
    "perfil": "admin",
    "ativo": 1
  },
  "tokens": {
    "access":  { "token": "eyJ...", "expires": "2026-04-21T15:00:00.000Z" },
    "refresh": { "token": "eyJ...", "expires": "2026-05-21T14:00:00.000Z" }
  }
}
```

### Credenciais seed (todos com senha `Oss@2026`)

| email | perfil |
|-------|--------|
| `admin@americana.sp.gov.br` | `admin` |
| `gestor@sms.americana.sp.gov.br` | `gestor_sms` |
| `auditora@sms.americana.sp.gov.br` | `auditora` |

---

## Task 1: Backend — Migrar `AuthService` para `tb_usuarios`

**Files:**
- Modify: `src/service/AuthService.js`

### Diagnóstico atual

`AuthService.loginWithEmailPassword` usa `UserDao` → tabela boilerplate `users` (campos: `uuid`, `email`, `password`). A tabela OSS `tb_usuarios` tem `usuario_id`, `email`, `senha_hash`.

- [ ] **Step 1: Abrir `src/service/AuthService.js` e localizar o método `loginWithEmailPassword`**

Linha relevante atual (usa boilerplate UserDao):
```javascript
let user = await this.userDao.findByEmail(email);
const isPasswordValid = await bcrypt.compare(password, user.password);
```

- [ ] **Step 2: Substituir o corpo do método para usar `models.usuario`**

Substituir o conteúdo completo de `src/service/AuthService.js` pelo seguinte:

```javascript
const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');
const models = require('../models');

const Usuario = models.usuario;

class AuthService {
    loginWithEmailPassword = async (email, password) => {
        try {
            const user = await Usuario.findOne({ where: { email, ativo: 1 } });

            if (!user) {
                return responseHandler.returnError(
                    httpStatus.BAD_REQUEST,
                    'E-mail não cadastrado ou inativo.',
                );
            }

            const isPasswordValid = await bcrypt.compare(password, user.senha_hash);
            if (!isPasswordValid) {
                return responseHandler.returnError(
                    httpStatus.BAD_REQUEST,
                    'Senha incorreta.',
                );
            }

            const data = user.toJSON();
            delete data.senha_hash;
            delete data.token_2fa;

            return responseHandler.returnSuccess(httpStatus.OK, 'Login Successful', data);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Erro interno no login.');
        }
    };

    logout = async (refreshToken) => {
        // mantém interface, mas tokens são gerenciados pelo TokenService
        return responseHandler.returnSuccess(httpStatus.OK, 'Logout realizado.');
    };
}

module.exports = AuthService;
```

- [ ] **Step 3: Verificar que `models.usuario` existe**

Abrir `src/models/index.js` e confirmar que `Usuario` é carregado. Se não for carregado automaticamente, adicionar:

```javascript
// Busca por: models.usuario ou models.Usuario
// O Sequelize usa o modelName definido em Usuario.js: 'usuario'
// Acesso: models.usuario (lowercase modelName)
```

Rodando o comando abaixo, deve aparecer `usuario` na lista:
```bash
node -e "const m = require('./src/models'); console.log(Object.keys(m))"
```
Saída esperada: lista com `user`, `token`, `usuario`, `contrato`, etc.

- [ ] **Step 4: Commit**

```bash
git add src/service/AuthService.js
git commit -m "refactor(auth): migrate login to tb_usuarios with senha_hash"
```

---

## Task 2: Backend — Migrar `TokenService` para usar `usuario_id`

**Files:**
- Modify: `src/service/TokenService.js`

### Diagnóstico atual

`TokenService.generateAuthTokens(user)` usa `user.uuid` como `sub` do JWT e como `user_uuid` na tabela `tokens`. Após Task 1, `user` vem de `tb_usuarios` e tem `usuario_id` em vez de `uuid`.

A tabela `tokens` **não tem FK constraint** para `users.uuid` — é apenas `DataTypes.UUID` sem referência — portanto podemos salvar qualquer UUID ali sem problema.

- [ ] **Step 1: Localizar `generateAuthTokens` em `src/service/TokenService.js`**

Trecho atual problemático (linhas ~93–130):
```javascript
generateAuthTokens = async (user) => {
    const accessToken = await this.generateToken(
        user.uuid,          // ← usar usuario_id
        accessTokenExpires,
        tokenTypes.ACCESS,
    );
    // ...
    authTokens.push({
        token: accessToken,
        user_uuid: user.uuid,   // ← usar usuario_id
        // ...
    });
```

- [ ] **Step 2: Substituir `user.uuid` por `user.usuario_id` em `generateAuthTokens`**

Localizar TODAS as ocorrências de `user.uuid` dentro do método `generateAuthTokens` e substituir por `user.usuario_id || user.uuid` (o fallback `|| user.uuid` mantém compatibilidade com o boilerplate se chamado por outro lugar):

```javascript
generateAuthTokens = async (user) => {
    const userId = user.usuario_id || user.uuid;  // OSS id ou fallback boilerplate

    const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = await this.generateToken(
        userId,
        accessTokenExpires,
        tokenTypes.ACCESS,
    );
    const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
    const refreshToken = await this.generateToken(
        userId,
        refreshTokenExpires,
        tokenTypes.REFRESH,
    );

    const authTokens = [];
    authTokens.push({
        token: accessToken,
        user_uuid: userId,
        expires: accessTokenExpires.toDate(),
        type: tokenTypes.ACCESS,
        blacklisted: false,
    });
    authTokens.push({
        token: refreshToken,
        user_uuid: userId,
        expires: refreshTokenExpires.toDate(),
        type: tokenTypes.REFRESH,
        blacklisted: false,
    });

    await this.saveMultipleTokens(authTokens);

    return {
        access: {
            token: accessToken,
            expires: accessTokenExpires.toDate(),
        },
        refresh: {
            token: refreshToken,
            expires: refreshTokenExpires.toDate(),
        },
    };
};
```

- [ ] **Step 3: Commit**

```bash
git add src/service/TokenService.js
git commit -m "refactor(auth): use usuario_id as JWT sub instead of uuid"
```

---

## Task 3: Backend — Migrar `passport.js` para carregar `Usuario`

**Files:**
- Modify: `src/config/passport.js`

### Diagnóstico atual

`jwtVerify` carrega o usuário via `userDao.findOneByWhere({ uuid: payload.sub })` — busca na tabela boilerplate `users`. Após Tasks 1–2, `payload.sub` = `usuario_id` (UUID de `tb_usuarios`). Precisamos carregar `Usuario` por `usuario_id`.

- [ ] **Step 1: Substituir `src/config/passport.js` pelo código abaixo**

```javascript
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('./config');
const { tokenTypes } = require('./tokens');
const TokenDao = require('../dao/TokenDao');
const RedisService = require('../service/RedisService');
const models = require('../models');

const Usuario = models.usuario;

const jwtOptions = {
    secretOrKey: config.jwt.secret,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    passReqToCallback: true,
};

const jwtVerify = async (req, payload, done) => {
    try {
        if (payload.type !== tokenTypes.ACCESS) {
            throw new Error('Invalid token type');
        }

        const authorization = req.headers.authorization
            ? req.headers.authorization.split(' ')
            : [];

        if (!authorization[1]) {
            return done(null, false);
        }

        // Verificar token no Redis (cache) ou no banco
        const redisService = new RedisService();
        const tokenDao = new TokenDao();

        let tokenDoc = redisService.hasToken(authorization[1], 'access_token');
        if (!tokenDoc) {
            tokenDoc = await tokenDao.findOne({
                token: authorization[1],
                type: tokenTypes.ACCESS,
                blacklisted: false,
            });
        }

        if (!tokenDoc) {
            return done(null, false);
        }

        // Carregar usuário de tb_usuarios por usuario_id
        const user = await Usuario.findOne({
            where: { usuario_id: payload.sub, ativo: 1 },
        });

        if (!user) {
            return done(null, false);
        }

        done(null, user);
    } catch (error) {
        console.error('[passport jwtVerify]', error.message);
        done(error, false);
    }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

module.exports = { jwtStrategy };
```

- [ ] **Step 2: Verificar que `models.usuario` está disponível**

```bash
node -e "const m = require('./src/models'); console.log(typeof m.usuario)"
```
Saída esperada: `function`

- [ ] **Step 3: Commit**

```bash
git add src/config/passport.js
git commit -m "refactor(auth): passport loads Usuario from tb_usuarios"
```

---

## Task 4: Backend — Testar o login real com o servidor rodando

**Pré-requisito:** Backend iniciado (`npm start`) e migrações/seeds aplicados (`npm run db:migrate && npm run db:seed`).

- [ ] **Step 1: Testar o endpoint de login via curl**

```bash
curl -s -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@americana.sp.gov.br\",\"password\":\"Oss@2026\"}" \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('status:', j.status, '| perfil:', j.data?.perfil, '| token:', j.tokens?.access?.token?.slice(0,20)+'...')"
```

Saída esperada:
```
status: true | perfil: admin | token: eyJhbGciOiJIUzI1NiIs...
```

- [ ] **Step 2: Testar uma rota autenticada com o token obtido**

```bash
TOKEN=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@americana.sp.gov.br\",\"password\":\"Oss@2026\"}" \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).tokens.access.token))")

curl -s http://localhost:4001/api/unidades?ativo=1 \
  -H "Authorization: Bearer $TOKEN" \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('unidades:', Array.isArray(j.data) ? j.data.length : j)"
```

Saída esperada (com seeds aplicados): `unidades: 5`

Se aparecer 401, verificar:
1. `npm run db:seed` foi executado (seed de usuários existe)
2. O token `sub` e o `user_uuid` na tabela `tokens` correspondem ao `usuario_id` correto
3. Conferir logs do backend para mensagem de erro específica

- [ ] **Step 3: Sem erros — não há commit nesta task (é validação)**

---

## Task 5: Frontend — Criar `frontend/.env.development`

**Files:**
- Create: `frontend/.env.development`

- [ ] **Step 1: Criar o arquivo**

Conteúdo de `frontend/.env.development`:
```dotenv
# Credenciais para auto-login em DEV (usuário seed do banco)
VITE_DEV_EMAIL=admin@americana.sp.gov.br
VITE_DEV_PASSWORD=Oss@2026
```

- [ ] **Step 2: Verificar que `.gitignore` NÃO exclui `.env.development`**

`.env.development` contém apenas credenciais do seed de desenvolvimento (não são segredos de produção), portanto pode e deve ser versionado. Verificar que não está em `.gitignore`. Se estiver, adicionar uma exceção:

```bash
# No .gitignore, adicionar se necessário:
!frontend/.env.development
```

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.development
git commit -m "chore(dev): add .env.development with seeded dev credentials"
```

---

## Task 6: Frontend — Refatorar `AuthContext.tsx` para login real

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`

### Diagnóstico atual

- `makeToken(u)`: gera um token fake (`btoa(JSON.stringify({...}))`), não um JWT real → rejeitado pelo Passport
- `login()`: busca em `mockUsuarios` (array local) em vez de chamar `POST /api/auth/login`
- Auto-login DEV: usa `makeToken(admin)` no `useState` initializer (síncrono)

### Estratégia

1. Remover `makeToken()` completamente
2. Converter `login()` para chamar `POST /api/auth/login`
3. Auto-login DEV: no `useEffect`, chamar `login()` com credenciais do `.env.development`
4. Fallback: se o backend estiver offline, ficar no estado não-autenticado (usuário vê tela de login, pode tentar logar manualmente — e verá erro explicativo)

- [ ] **Step 1: Substituir `frontend/src/contexts/AuthContext.tsx` pelo código abaixo**

```typescript
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import type { Usuario, Perfil } from '../types'

interface AuthState {
  user: Usuario | null
  token: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (perfis: Perfil[]) => boolean
  darkMode: boolean
  toggleDarkMode: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

interface LoginResponse {
  status: boolean
  message: string
  data: Usuario
  tokens: {
    access: { token: string; expires: string }
    refresh: { token: string; expires: string }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('oss_auth')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* fall through */ }
    }
    return { user: null, token: null, isAuthenticated: false }
  })

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('oss_dark_mode') === 'true',
  )

  // Single source of truth for the data-theme attribute and localStorage sync.
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('oss_dark_mode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (auth.isAuthenticated) {
      localStorage.setItem('oss_auth', JSON.stringify(auth))
    } else {
      localStorage.removeItem('oss_auth')
    }
  }, [auth])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const body: LoginResponse = await res.json()

    if (!res.ok || !body.status) {
      throw new Error(body.message || `Erro ${res.status}`)
    }

    setAuth({
      user: body.data,
      token: body.tokens.access.token,
      isAuthenticated: true,
    })
  }, [])

  const logout = useCallback(() => {
    setAuth({ user: null, token: null, isAuthenticated: false })
    localStorage.removeItem('oss_auth')
  }, [])

  const hasPermission = useCallback(
    (perfis: Perfil[]) => {
      if (!auth.user) return false
      return perfis.includes(auth.user.perfil)
    },
    [auth.user],
  )

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev)
  }, [])

  // Em DEV: auto-login com credenciais do seed ao montar (se não há sessão salva).
  // Se o backend estiver offline, o usuário vê a tela de login e pode tentar manualmente.
  const devLoginAttempted = useRef(false)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (auth.isAuthenticated) return
    if (devLoginAttempted.current) return
    devLoginAttempted.current = true

    const email    = import.meta.env.VITE_DEV_EMAIL    ?? 'admin@americana.sp.gov.br'
    const password = import.meta.env.VITE_DEV_PASSWORD ?? 'Oss@2026'

    login(email, password).catch(err => {
      console.warn('[DEV] Auto-login falhou (backend offline?):', err.message)
    })
  }, [auth.isAuthenticated, login])

  return (
    <AuthContext.Provider
      value={{ ...auth, login, logout, hasPermission, darkMode, toggleDarkMode }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Verificar que `mockUsuarios` ainda é importado em algum outro lugar**

Se `mockUsuarios` for importado SOMENTE em `AuthContext.tsx`, remover a importação. Buscar:

```bash
# Verificar outros arquivos que importam mockUsuarios
grep -r "mockUsuarios" frontend/src --include="*.ts" --include="*.tsx" -l
```

Se apenas `AuthContext.tsx` importava (após remover deste arquivo), a variável continua existindo em `mock.ts` mas não é usada — isso é OK, não deletar (pode ser usada futuramente).

- [ ] **Step 3: Verificar build sem erros**

```bash
cd frontend && npx tsc --noEmit
```

Saída esperada: nenhum erro

- [ ] **Step 4: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "feat(auth): real JWT login in DEV via POST /api/auth/login"
```

---

## Task 7: Validação End-to-End em DEV

**Pré-requisito:** Backend rodando com seeds aplicados, frontend em `npm run dev`.

- [ ] **Step 1: Limpar o localStorage e recarregar**

No DevTools do browser:
```javascript
localStorage.clear()
location.reload()
```

- [ ] **Step 2: Verificar o console**

Não deve aparecer:
- `401 (Unauthorized)` nas chamadas de API
- `[DEV] Auto-login falhou`

Deve aparecer (Network tab): `POST /api/auth/login` → 200 OK

- [ ] **Step 3: Navegar para `/entrada-mensal`**

Deve carregar os cards de unidades **reais do banco** (não os mocks `UPA Central`, `Hospital Municipal`, `Pronto Socorro Norte`).

Se o banco tiver os seeds aplicados, verá as unidades: HMA, UNACON, UPA 24h Cillos, UPA 24h Dona Rosa, UPA 24h Santa Bárbara.

- [ ] **Step 4: Verificar que o mock fallback continua funcionando para outros erros**

Para testar: parar o backend e recarregar a página. O DEV auto-login deve falhar silenciosamente (log no console), e a tela de login deve aparecer sem crashar. Ao entrar com `admin@americana.sp.gov.br` manualmente (backend offline), o erro `Erro 502` ou similar deve aparecer no formulário.

- [ ] **Step 5: Remover mock fallbacks de componentes que não precisam mais deles**

Agora que o 401 não ocorre mais em DEV com backend rodando, os fallbacks em componentes que verificam `import.meta.env.DEV` para dados mock podem ser auditados. **Manter os que cobrem "backend offline"**, remover apenas os que eram workaround para 401:

- `EntradaMensalHub.tsx`: manter `mockUnidades` como fallback (cobre backend offline)
- `EntradaMensalList.tsx`: manter `mockAcompanhamentos` como fallback (cobre backend offline)

Esses fallbacks agora só disparam quando o backend está realmente indisponível, não mais para 401.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "chore(dev): validate E2E real DB access in DEV environment"
```

---

## Self-Review

### Spec coverage

| Requisito | Task |
|-----------|------|
| Login real contra `tb_usuarios` | Task 1 |
| JWT com `usuario_id` como `sub` | Task 2 |
| Passport carrega `Usuario` com `perfil` | Task 3 |
| RBAC funciona com `req.user.perfil` | Task 3 (Usuario tem `perfil`) |
| Frontend usa JWT real em DEV | Task 6 |
| Auto-login DEV sem intervenção manual | Task 6 |
| Fallback gracioso se backend offline | Task 6 (catch silencioso) |
| Variáveis de ambiente separadas | Task 5 |

### Edge cases cobertos

- **Backend offline ao iniciar DEV**: auto-login falha silenciosamente → tela de login → usuário vê mensagem de erro ao tentar login manual
- **Token expirado em sessão salva**: `useApi.ts` já trata 401 em PROD com logout; em DEV componentes fazem fallback para mock — mas agora o mock só dispara para erros reais, não 401 de token fake
- **Compatibilidade com boilerplate `users`**: `TokenService` mantém `|| user.uuid` como fallback; `passport.js` agora carrega exclusivamente `tb_usuarios` (sem fallback para `users` — o boilerplate não tem `perfil`, causaria erros de RBAC mesmo se autenticado)

### Não incluído neste plano (fora do escopo)

- Refresh token no frontend (token expira em `accessExpirationMinutes` minutos)
- Logout que invalida o token no banco/Redis
- Login 2FA (campo `token_2fa` em `tb_usuarios`)
- Migração que remove a tabela boilerplate `users` (pode ser feita separadamente)
