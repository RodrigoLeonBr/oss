# Project Rules and Guidelines

> Auto-generated from .context/docs on 2026-04-21T13:55:52.465Z

## README

# Documentation Index

Welcome to the repository knowledge base. Start with the project overview, then dive into specific guides as needed.

## Core Guides
- [Project Overview](./project-overview.md)
- [Development Workflow](./development-workflow.md)
- [Testing Strategy](./testing-strategy.md)
- [Tooling & Productivity Guide](./tooling.md)

## Repository Snapshot
- `design/` — Design System HTML/JSX (tokens CSS, componentes, tabelas, gráficos)
- `docs/` — Documentação do produto (PRD_v2, ARQUITETURA_v2, banco_v2, erd_v2)
- `frontend/` — React 18 + TypeScript + Vite 8 (Rolldown)
  - `src/pages/Oss/` — CRUD Organizações Sociais (List + FormModal + DeleteModal)
  - `src/pages/Contratos/` — CRUD Contratos de Gestão (List + FormModal + DeleteModal)
- `package.json` — Scripts npm (start, build, db:migrate, db:seed)
- `README.md` — Guia rápido de setup
- `specs/` — Especificações OpenAPI da autenticação
- `src/` — Backend Node.js/Express (controllers, services, models, migrations)

## Document Map
| Guide | File | Primary Inputs |
| --- | --- | --- |
| Project Overview | `project-overview.md` | Roadmap, README, stakeholder notes |
| Development Workflow | `development-workflow.md` | Branching rules, CRUD pattern, DEV mock strategy |
| Testing Strategy | `testing-strategy.md` | Test configs, CI gates, validação client-side CRUD |
| Tooling & Productivity Guide | `tooling.md` | CLI scripts, Vite 8/Rolldown, react-window v2, TypeScript quirks |

## Key Patterns (resumo rápido)

| Situação | Padrão |
| --- | --- |
| Nova página CRUD | `types.ts` → `List.tsx` → `FormModal.tsx` → `DeleteModal.tsx` → `App.tsx` lazy + rota |
| Input sem `erasableSyntaxOnly` | Declarar propriedade antes do `constructor`, não como parameter property |
| react-window | API v2: `List` + `rowComponent` + `rowCount` + `rowHeight` + `rowProps` |
| 401 em DEV | `useApi` não faz logout; componente faz fallback para mock no `catch` |
| `Field` dentro de modal | Definir fora do componente pai para evitar perda de foco a cada render |
| Tabela responsiva | `overflow-x-auto` + `minWidth` envolvendo **header + body** juntos |


## README

# Q&A Index

Project type: **library**

Generated: 2026-04-13T02:41:48.530Z

## Getting-started

- [How do I set up and run this project?](./getting-started.md)

## Architecture

- [How is the codebase organized?](./project-structure.md)

## Features

- [How does authentication work?](./authentication.md)
- [How is data stored and accessed?](./database.md)
- [What API endpoints are available?](./api-endpoints.md)

## Operations

- [How does caching work?](./caching.md)
- [How are errors handled?](./error-handling.md)
- [How do I deploy this project?](./deployment.md)

## Testing

- [How do I run and write tests?](./testing.md)

