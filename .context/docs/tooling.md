---
type: doc
name: tooling
description: Scripts, IDE settings, automation, and developer productivity tips
category: tooling
generated: 2026-04-13
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

### Scripts npm disponíveis

```bash
npm start              # Inicia o servidor backend (porta 5000)
npm test               # Executa testes Jest
npm run db:migrate     # Aplica migrações pendentes
npm run db:migrate:undo # Desfaz última migração
npm run db:seed        # Executa todos os seeders
npm run db:seed:undo   # Desfaz todos os seeds
```

### Scripts frontend

```bash
cd frontend
npm run dev            # Dev server Vite (porta 5173, proxy /api → 5000)
npm run build          # Build de produção
npm run preview        # Preview do build
npx tsc --noEmit       # Verificação de tipos TypeScript
```

### Sequelize CLI

```bash
npx sequelize-cli migration:generate --name create-nova-tabela
npx sequelize-cli seed:generate --name seed-dados-iniciais
npx sequelize-cli db:migrate:status
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
