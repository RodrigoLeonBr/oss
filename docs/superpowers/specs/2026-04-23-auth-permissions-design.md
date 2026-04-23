# Auth & Permissions — Design Spec
**Date:** 2026-04-23  
**Status:** Approved

---

## 1. Goals

1. Validate session on every app load (local JWT decode, redirect to `/login` if expired).
2. Protect all routes — access driven by DB permissions, not hardcoded `allowedPerfis`.
3. Control per-module CRUD actions (view / insert / update / delete) per perfil.
4. Scope contratada profiles to their own OSS data (`escopo = 'proprio'`).
5. Admin UI to manage users and permission matrix.

---

## 2. Decisions

| Question | Decision |
|---|---|
| Permissions stored | DB table `tb_permissoes_perfil` |
| Permissions per | Perfil (not per user) |
| Session validation | Local JWT decode, check `exp` |
| User management | Admin + gestor_sms |
| Approach | Full DB-driven + cached at login |

---

## 3. Data Model

### 3.1 New table: `tb_permissoes_perfil`

```sql
perm_id    CHAR(36)       PK, UUID()
perfil     ENUM(admin, gestor_sms, auditora, conselheiro_cms,
                contratada_scmc, contratada_indsh,
                central_regulacao, visualizador)   NOT NULL
modulo     VARCHAR(50)    NOT NULL
can_view   TINYINT(1)     NOT NULL DEFAULT 0
can_insert TINYINT(1)     NOT NULL DEFAULT 0
can_update TINYINT(1)     NOT NULL DEFAULT 0
can_delete TINYINT(1)     NOT NULL DEFAULT 0
escopo     ENUM('global','proprio') NOT NULL DEFAULT 'global'
UNIQUE KEY uq_perfil_modulo (perfil, modulo)
```

### 3.2 Modules (12)

| modulo | Route |
|---|---|
| `dashboard` | /dashboard |
| `entrada_mensal` | /entrada-mensal |
| `aprovacao` | /aprovacao |
| `relatorios` | /relatorios |
| `perfil_oss` | /perfil-oss |
| `oss` | /oss |
| `contratos` | /contratos |
| `unidades` | /unidades |
| `indicadores` | /indicadores |
| `metas` | /metas |
| `usuarios` | /admin/usuarios |
| `permissoes` | /admin/permissoes |

### 3.3 Seed defaults

Seed file translates current hardcoded `allowedPerfis` from `App.tsx` into DB rows.

**admin:** all modules, all actions, escopo=global  
**gestor_sms:** all modules except `usuarios`/`permissoes` view only; can_insert/update on operational modules; escopo=global  
**auditora:** dashboard, aprovacao, indicadores, relatorios — view + update; escopo=global  
**conselheiro_cms:** relatorios — view only; escopo=global  
**central_regulacao:** dashboard, relatorios — view only; escopo=global  
**visualizador:** dashboard, relatorios — view only; escopo=global  
**contratada_scmc / contratada_indsh:**

| modulo | view | insert | update | delete | escopo |
|---|---|---|---|---|---|
| perfil_oss | 1 | 0 | 0 | 0 | proprio |
| contratos | 1 | 0 | 0 | 0 | proprio |
| unidades | 1 | 0 | 1 | 0 | proprio |
| indicadores | 1 | 0 | 1 | 0 | proprio |
| metas | 1 | 0 | 0 | 0 | proprio |
| entrada_mensal | 1 | 1 | 1 | 0 | proprio |

### 3.4 `tb_usuarios` — no schema change

Existing table already has `senha_hash`, `perfil`, `oss_id`, `ativo`. Only the backend service needs rewriting to use this model instead of the old generic `User` model.

---

## 4. Backend

### 4.1 Auth wiring — already done ✅

`AuthService.loginWithEmailPassword` already uses `Usuario` model, compares against `senha_hash` with bcrypt, strips `senha_hash`/`token_2fa` from response.

`passport.js` already hydrates `req.user` from `tb_usuarios` via `Usuario.findOne({ usuario_id: payload.sub, ativo: 1 })`.

`TokenService.generateAuthTokens` already uses `user.usuario_id` as `sub` in JWT payload.

**One minor fix needed:** `AuthController.refreshTokens` calls `this.userService.getUserByUuid(refreshTokenDoc.user_uuid)` which uses the old `User` model. Must be updated to query `Usuario` by `usuario_id` directly.

### 4.2 New: `UsuarioService.js`

| Method | Description |
|---|---|
| `createUsuario(body)` | Validates perfil, hashes password → senha_hash, requires oss_id if contratada |
| `getUsuarioByEmail(email)` | Used in login |
| `getUsuarioById(id)` | Used in JWT hydration + refresh |
| `listUsuarios(callerPerfil)` | gestor_sms cannot see admin/gestor_sms users |
| `updateUsuario(id, body)` | Update nome, email, telefone, perfil, ativo |
| `deactivateUsuario(id)` | Sets ativo=0 (soft delete) |

### 4.3 New: `PermissaoService.js`

| Method | Description |
|---|---|
| `getPermissoesByPerfil(perfil)` | Returns all rows for perfil |
| `upsertPermissao(perfil, modulo, data)` | Insert or update one row |
| `getAllPermissoes()` | Admin view — all perfis |

### 4.4 New: `UsuarioController.js`

```
GET    /api/usuarios           → listUsuarios (admin, gestor_sms)
POST   /api/usuarios           → createUsuario (admin, gestor_sms)
PUT    /api/usuarios/:id       → updateUsuario (admin, gestor_sms)
DELETE /api/usuarios/:id       → deactivateUsuario (admin only)
```

### 4.5 New: `PermissaoController.js`

```
GET /api/permissoes/:perfil    → getPermissoesByPerfil (admin)
PUT /api/permissoes/:perfil    → upsertPermissoes batch (admin)
```

### 4.6 New: `GET /api/auth/me/permissions`

Auth required. Returns all `tb_permissoes_perfil` rows for `req.user.perfil`. Called by frontend once after login.

### 4.7 Updated: `rbac.js`

Keep existing `authorize(...roles)` for route-level guards.  
Add `checkPermission(modulo, action)` middleware: queries DB for perfil+modulo row, checks the relevant `can_*` column. Used on POST/PUT/DELETE endpoints.

When `escopo = 'proprio'` and endpoint involves an OSS-scoped resource, backend applies `WHERE oss_id = req.user.oss_id` filter. Extends existing `verificarAcessoUnidade` behavior to be DB-driven.

---

## 5. Frontend

### 5.1 Session validation on load

In `AuthContext`, after reading localStorage:

```ts
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp < Math.floor(Date.now() / 1000)
  } catch {
    return true
  }
}
```

If expired → clear state → `isAuthenticated = false` → `ProtectedRoute` redirects to `/login`.

### 5.2 AuthContext additions

```ts
interface AuthContextType {
  // existing: user, token, isAuthenticated, login, logout, darkMode, toggleDarkMode
  permissions: PermissaoPerfil[]
  canDo: (modulo: string, action: 'view' | 'insert' | 'update' | 'delete') => boolean
  escopo: (modulo: string) => 'global' | 'proprio' | null
  permissionsLoaded: boolean
}
```

`permissions` loaded by calling `GET /api/auth/me/permissions` immediately after successful login and on app load when token is valid.

### 5.3 ProtectedRoute update

Remove `allowedPerfis` prop. New prop: `modulo: string`. Redirects if `!canDo(modulo, 'view')`.

```tsx
<ProtectedRoute modulo="contratos">
  <AppLayout><ContratosList /></AppLayout>
</ProtectedRoute>
```

Special case: `/login` and `/` need no guard.

### 5.4 `usePermission` hook

```ts
// frontend/src/hooks/usePermission.ts
function usePermission(modulo: string) {
  const { canDo } = useAuth()
  return {
    canView:   canDo(modulo, 'view'),
    canInsert: canDo(modulo, 'insert'),
    canUpdate: canDo(modulo, 'update'),
    canDelete: canDo(modulo, 'delete'),
  }
}
```

Used in list pages to conditionally render action buttons and form modals.

### 5.5 New: `PermissaoType` in `types/index.ts`

```ts
export interface PermissaoPerfil {
  perm_id: string
  perfil: Perfil
  modulo: string
  can_view: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
  escopo: 'global' | 'proprio'
}
```

### 5.6 New pages

**`/admin/usuarios`** — access: admin + gestor_sms

- Table columns: nome, email, perfil, ativo (badge), ultimo_acesso, oss vinculada
- Actions: create (FormModal), edit (FormModal), activate/deactivate (toggle)
- `gestor_sms` sees list filtered to exclude admin/gestor_sms rows; cannot set perfil to admin/gestor_sms
- Follow existing CRUD pattern: `types.ts` → `UsuariosList.tsx` → `UsuariosFormModal.tsx` → `UsuariosDeleteModal.tsx`

**`/admin/permissoes`** — access: admin only

- Perfil dropdown selector
- Matrix table: rows = 12 modules, columns = view / insert / update / delete / escopo
- Checkboxes for boolean columns, select for escopo
- Save button sends batch `PUT /api/permissoes/:perfil`
- Visual feedback on save (success/error toast)

---

## 6. Migration Plan

### New migration files
1. `20260423000001-create-tb-permissoes-perfil.js` — creates table
2. `20260423000002-seed-permissoes-defaults.js` — seeds defaults from current hardcoded rules

### Files to create (backend)
- `src/service/UsuarioService.js`
- `src/service/PermissaoService.js`
- `src/controllers/UsuarioController.js`
- `src/controllers/PermissaoController.js`
- `src/models/PermissaoPerfil.js`
- `src/route/usuarioRoute.js`
- `src/route/permissaoRoute.js`

### Files to update (backend)
- `src/controllers/AuthController.js` — fix `refreshTokens` to use `Usuario` model instead of old `UserService.getUserByUuid`; add `me/permissions` action
- `src/route/authRoute.js` — add `GET /me/permissions` route
- `src/middlewares/rbac.js` — add `checkPermission(modulo, action)` middleware
- `src/app.js` — register usuarioRoute, permissaoRoute

### Files to create (frontend)
- `frontend/src/hooks/usePermission.ts`
- `frontend/src/pages/Admin/UsuariosList.tsx`
- `frontend/src/pages/Admin/UsuariosFormModal.tsx`
- `frontend/src/pages/Admin/UsuariosDeleteModal.tsx`
- `frontend/src/pages/Admin/PermissoesMatrix.tsx`
- `frontend/src/pages/Admin/types.ts`

### Files to update (frontend)
- `frontend/src/contexts/AuthContext.tsx` — add permissions, canDo, escopo, token expiry check
- `frontend/src/components/layout/ProtectedRoute.tsx` — modulo-based guard
- `frontend/src/App.tsx` — replace allowedPerfis with modulo prop, add admin routes
- `frontend/src/types/index.ts` — add PermissaoPerfil type
- `frontend/src/components/SidebarMenu.tsx` — show/hide menu items based on canDo

---

## 7. Out of Scope

- 2FA (field exists in DB but not activated)
- Token refresh automation (refresh endpoint exists, not wired to frontend)
- Email verification
- Per-user permission overrides
