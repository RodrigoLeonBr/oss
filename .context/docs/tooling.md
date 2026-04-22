---
type: doc
name: tooling
description: Scripts, IDE settings, automation, and developer productivity tips
category: tooling
generated: 2026-04-19
status: filled
scaffoldVersion: "2.0.0"
---

## Tooling & Productivity Guide

Este guia documenta as ferramentas, scripts e configurações necessárias para desenvolver eficientemente no projeto OSS Saúde Americana.

## Required Tooling

- **Node.js** >= 22.x — Runtime backend e frontend build
  - Instalação: https://nodejs.org ou `nvm install 22`
- **MySQL** >= 8.0 — Banco de dados principal (UUIDs nativos, colunas geradas)
  - Instalação: XAMPP (recomendado para Windows) ou `apt install mysql-server`
- **Redis** (opcional) — Cache de sessões e dados frequentes
  - Instalação: `apt install redis-server` ou Docker
- **Sequelize CLI** — Gerenciamento de migrações e seeds
  - Instalado como devDependency: `npx sequelize-cli`
- **Git** — Controle de versão

## Recommended Automation

### Scripts npm disponíveis (raiz)

```bash
npm start              # Inicia o servidor backend (porta 5000)
npm test               # Executa testes Jest
npm run build          # Build completo: tsc + vite build (frontend)
npm run db:migrate     # Aplica migrações pendentes
npm run db:migrate:undo # Desfaz última migração
npm run db:seed        # Executa todos os seeders
npm run db:seed:undo   # Desfaz todos os seeds
```

### Scripts frontend

```bash
cd frontend
npm run dev            # Dev server Vite (porta 3000 ou 5173, proxy /api → 5000)
npm run build          # Build de produção (tsc && vite build com Rolldown)
npm run preview        # Preview do build de produção
npx tsc --noEmit       # Verificação de tipos TypeScript (deve ter zero erros)
```

### Sequelize CLI

```bash
npx sequelize-cli migration:generate --name create-nova-tabela
npx sequelize-cli seed:generate --name seed-dados-iniciais
npx sequelize-cli db:migrate:status
```

## Vite 8 + Rolldown

O frontend usa **Vite 8** com o engine **Rolldown** (substituto do Rollup). Diferenças importantes:

- `manualChunks` **deve ser uma função** (não objeto):
  ```typescript
  manualChunks(id: string) {
    if (id.includes('node_modules/chart.js')) return 'vendor-charts'
    if (id.includes('node_modules/react/')) return 'vendor-react'
    // ...
  }
  ```
- Chunks gerados: `vendor-react`, `vendor-charts`, `vendor-ui` (react-window + lucide-react)
- Todas as páginas são lazy-loaded via `React.lazy()` + `Suspense` para code-splitting automático

## react-window v2

O projeto usa **react-window v2** (API diferente da v1). Não instalar `@types/react-window` separado.

```typescript
// ✅ API v2 correta
import { List, type RowComponentProps } from 'react-window'

function MinhaRow({ ariaAttributes, index, style, ...rowProps }: RowComponentProps<MeuRowProps>) { ... }

<List
  rowComponent={MinhaRow}
  rowCount={items.length}
  rowHeight={52}
  rowProps={{ items, onEdit, onDelete }}
  overscanCount={5}
  style={{ height: listHeight, width: tableWidth }}
/>

// ❌ API v1 (não usar)
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
```

## TypeScript — `erasableSyntaxOnly`

O `tsconfig.json` tem `erasableSyntaxOnly: true` (padrão Vite 6+). Isso **proíbe parameter properties** em construtores:

```typescript
// ❌ Proibido — parameter property
class ApiError extends Error {
  constructor(public readonly status: number, message: string) { ... }
}

// ✅ Correto — propriedade declarada separadamente
class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
```

## IDE / Editor Setup

### VS Code / Cursor Extensions Recomendadas

- **ESLint** — Linting JavaScript
- **Tailwind CSS IntelliSense** — Autocomplete de classes Tailwind
- **MySQL** (cweijan.vscode-mysql-client2) — Cliente MySQL integrado
- **Thunder Client** ou **REST Client** — Testes de API REST
- **Sequelize VSCode** — Syntax highlighting para migrations

### Configurações Recomendadas

```json
{
  "editor.tabSize": 2,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.eol": "\n",
  "emmet.includeLanguages": { "javascript": "javascriptreact" }
}
```

## Productivity Tips

### Variáveis de ambiente

O arquivo `.env` controla toda a configuração. Copie `.env.example` e ajuste:
- `DB_PASS`: vazio para XAMPP local (validação permite string vazia)
- `REDIS_PASSWORD`: vazio para Redis local sem auth
- `JWT_SECRET`: chave secreta para tokens JWT

### Docker

```bash
docker-compose up -d   # Sobe MySQL + Redis + backend
```

### Workflow de migração v1 → v2

Ao alterar o schema significativamente:
1. `npm run db:migrate:undo:all` (desfaz tudo)
2. Deletar arquivos de migration antigos
3. Criar novas migrations na ordem correta de dependências FK
4. `npm run db:migrate` (aplica tudo)
5. Deletar seeders antigos e criar novos
6. `npm run db:seed`

### Monitoramento de cron jobs

Os cron jobs são definidos em `src/cronJobs.js` e executam:
- Cálculo automático de descontos (dia 5 de cada mês)
- Alerta de documentação regulatória expirando (semanal)
- Lembrete de acompanhamento não preenchido (dia 3 de cada mês)

### Depuração de erros comuns de build

| Erro | Causa | Solução |
|------|-------|---------|
| `TS1294: erasableSyntaxOnly` | Parameter property em constructor | Declare a propriedade antes do `constructor` |
| `manualChunks is not a function` | Rolldown exige função, não objeto | Converter `manualChunks: {}` para `manualChunks(id) {}` |
| `Module has no exported member 'FixedSizeList'` | react-window v2 mudou API | Usar `List` + `RowComponentProps` da v2 |
| `chunk > 500 kB` | Dependência grande no chunk principal | Adicionar entry em `manualChunks` |
