---
type: doc
name: development-workflow
description: Day-to-day engineering processes, branching, and contribution guidelines
category: workflow
generated: 2026-04-21
status: filled
scaffoldVersion: "2.0.0"
---

## Development Workflow

O fluxo de desenvolvimento segue o padrão MVC em camadas no backend e um padrão de páginas CRUD no frontend. Para adicionar funcionalidades backend, trabalhe na ordem: Migration → Model → DAO → Service → Validator → Controller → Route. No frontend, o padrão é: `types.ts` → `List.tsx` → `FormModal.tsx` → `DeleteModal.tsx` → registrar rota em `App.tsx`.

O ciclo típico de uma feature completa envolve:

**Backend:**
1. Criar migration Sequelize para alterações no schema MySQL
2. Criar/atualizar o Model Sequelize correspondente
3. Adicionar lógica de negócio no Service
4. Criar validação Joi no Validator
5. Expor via Controller e registrar a Route

**Frontend:**
6. Criar `frontend/src/pages/<Entidade>/types.ts` com interfaces TypeScript, helpers de formatação, `unwrap()` e `mockRecords` (fallback DEV)
7. Criar `<Entidade>List.tsx` — tabela virtualizada react-window v2, filtros, stats cards, toasts
8. Criar `<Entidade>FormModal.tsx` — modal criar/editar com validação, mock DEV em `catch`
9. Criar `<Entidade>DeleteModal.tsx` — modal confirmação
10. Adicionar `lazy()` import e rota em `App.tsx`
11. Simplificar entrada no `SidebarMenu.tsx` (mover de `MENU_GROUPS` para `NAV_ITEMS` se CRUD for self-contained)

## Padrão CRUD Frontend

Cada módulo CRUD em `frontend/src/pages/<Entidade>/` segue esta estrutura:

```
types.ts              — interfaces, helpers, mock data, unwrap()
<Entidade>List.tsx    — página principal (tabela virtualizada, filtros, modais)
<Entidade>FormModal.tsx — modal criar/editar
<Entidade>DeleteModal.tsx — modal confirmação de exclusão
```

### Convenções obrigatórias

- **`Field` e `inputCls`**: definidos **fora** do componente modal para evitar remontagem e perda de foco a cada render
- **DEV mock fallback**: `catch` nos fetches faz `if (import.meta.env.DEV) setState(mockData)` — `useApi` não chama `logout()` em DEV
- **`ApiError`**: importe de `../../hooks/useApi` para distinguir status HTTP (401, 404, 409, 5xx) sem depender do texto da mensagem
- **Tabela responsiva**: `overflow-x-auto` + `minWidth` no container interno; `tableRef` cobre **header + body** juntos para scroll horizontal sincronizado
- **react-window v2**: use `List` com `rowComponent`, `rowCount`, `rowHeight`, `rowProps` (não `FixedSizeList` nem `itemData`)

### Autenticação em DEV

O `AuthContext` faz login real via `POST /api/auth/login` usando credenciais de `frontend/.env.development`:

```
VITE_DEV_EMAIL=admin@americana.sp.gov.br
VITE_DEV_PASSWORD=Oss@2026
```

Isso garante que o token enviado nos headers é um JWT válido, reconhecido pelo backend. O auto-login ocorre no mount do `AuthProvider` se o usuário não estiver autenticado.

Porém, para endpoints que ainda não estão implementados no backend (ex: `/api/oss`, `/api/contratos`), o `useApi` **não chama `logout()`** em DEV para erros 401 ou 404 — o erro é propagado e os `catch` blocks fazem fallback para mock data:

```typescript
// useApi.ts — comportamento por ambiente:
if (res.status === 401) {
  if (!import.meta.env.DEV) logout()   // só em PROD
  throw new ApiError(401, 'Sessão expirada.')
}

// Componente — catch cobre qualquer status:
} catch {
  if (import.meta.env.DEV) setLista(mockData)
}
```

## Branching & Releases

- **Modelo**: Feature branches a partir de `main`
- **Convenção de branch**: `feature/<nome>`, `fix/<nome>`, `chore/<nome>`
- **Merge**: Via Pull Request com revisão obrigatória
- **Tags**: Semantic versioning (`v1.0.0`, `v1.1.0`, etc.)
- **Ambiente**: Desenvolvimento local com XAMPP (MySQL) + Node.js

## Local Development

- **Instalar dependências backend**: `npm install`
- **Instalar dependências frontend**: `cd frontend && npm install`
- **Configurar ambiente**: `cp .env.example .env` (editar DB_HOST, DB_NAME, DB_USER, DB_PASS)
- **Criar banco**: `mysql -u root -e "CREATE DATABASE oss;"`
- **Executar migrações**: `npm run db:migrate`
- **Desfazer migrações**: `npm run db:migrate:undo`
- **Popular dados**: `npm run db:seed`
- **Iniciar backend**: `npm start` (porta 5000)
- **Iniciar frontend**: `cd frontend && npm run dev` (porta 3000 ou 5173)
- **Build frontend**: `cd frontend && npm run build` (executa `tsc && vite build`)
- **TypeScript check**: `cd frontend && npx tsc --noEmit`

## Code Review Expectations

Toda alteração deve passar por revisão antes do merge. O checklist inclui:

- **Conformidade arquitetural**: Respeitar a separação de camadas (Route → Controller → Service → DAO → Model)
- **Migrações reversíveis**: Toda migration deve ter `up` e `down` funcionais
- **Validação**: Inputs de API validados com Joi antes de chegar ao Service
- **RBAC**: Rotas protegidas com `auth()` e `authorize([...perfis])` adequados; `ProtectedRoute` no frontend com `allowedPerfis`
- **LGPD/Auditoria**: Ações sensíveis logadas via middleware `auditoria`
- **Tipos frontend**: Interfaces TypeScript atualizadas quando schema muda (tanto `types/index.ts` quanto `pages/<Entidade>/types.ts`)
- **Sem PII no frontend**: Dados pessoais não expostos em localStorage ou logs do cliente
- **UUIDs**: Chaves primárias usam UUID v4, nunca IDs sequenciais expostos
- **TypeScript `erasableSyntaxOnly`**: **Não usar** parameter properties em construtores (`public readonly x`). Declare propriedades separadamente antes do `constructor`
- **Build limpo**: `npm run build` deve completar sem erros de tipo TypeScript

## Onboarding Tasks

1. Leia `docs/PRD_v2.md` para entender o domínio (contratos de gestão, indicadores, descontos)
2. Leia `docs/ARQUITETURA_v2.md` para entender o stack e padrões
3. Explore `docs/banco_v2.md` e `docs/erd_v2.md` para o schema do banco
4. Execute o setup local completo (migrações + seeds)
5. Navegue pelo frontend (`/oss` e `/contratos`) para entender o padrão CRUD implementado
6. Consulte `testing-strategy.md` e `tooling.md` para ferramentas e testes
