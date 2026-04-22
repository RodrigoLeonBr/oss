---
type: doc
name: project-overview
description: High-level overview of the project, its purpose, and key components
category: overview
generated: 2026-04-21
status: filled
scaffoldVersion: "2.0.0"
---

## Project Overview

O **OSS Saúde Americana** é um sistema de acompanhamento de contratos de gestão entre a Secretaria Municipal de Saúde (SMS) de Americana/SP e Organizações Sociais de Saúde (OSS). Ele automatiza o ciclo mensal de coleta de indicadores, cálculo de descontos por descumprimento de metas, geração de repasses financeiros e produção de relatórios para o Conselho Municipal de Saúde (CMS) e Tribunal de Contas (TCESP), garantindo conformidade com LGPD e transparência pública.

## Codebase Reference

> **Semantic Snapshot**: Use `context({ action: "getMap", section: "all" })` para obter stack, camadas arquiteturais, arquivos-chave e hotspots de dependência gerados automaticamente.

## Quick Facts

- **Root**: `E:/xampp/htdocs/oss`
- **Linguagens**: JavaScript (backend Node.js), TypeScript (frontend React)
- **Entry Backend**: `src/app.js`
- **Entry Frontend**: `frontend/src/main.tsx`
- **Banco de dados**: MySQL 8+ via Sequelize ORM
- **Frontend porta**: 3000 (dev server Vite/Docker) → proxy `/api` → backend porta 5000
- **Autenticação DEV**: auto-login via `frontend/.env.development` (`VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD`)
- **Semantic snapshot**: `context({ action: "getMap", section: "all" })`

## Entry Points

- **Backend API**: [`src/app.js`](src/app.js) — servidor Express, porta 5000
- **Frontend SPA**: [`frontend/src/main.tsx`](frontend/src/main.tsx) — React 18 + Vite 8 (Rolldown)
- **Migrations**: `src/db/migrations/` — Sequelize CLI
- **Seeders**: `src/db/seeders/` — dados iniciais (2 OSS, 3 contratos, 5 unidades, 28 indicadores)
- **Cron Jobs**: [`src/cronJobs.js`](src/cronJobs.js) — tarefas agendadas (descontos, alertas)

## Key Exports

**Backend Services:**
- `AuthService` — login via `tb_usuarios` com `senha_hash` (bcrypt)
- `TokenService` — JWT com `sub = usuario_id`, tokens em tabela `tokens`
- `AcompanhamentosService` — entrada mensal, cálculo de `status_cumprimento`
- `MetaService` — CRUD de metas com `meta_tipo` (maior_igual / menor_igual)
- `OssService`, `UnidadeService` — CRUD de OSS e Unidades de Saúde
- `ContratoService`, `IndicadorService` — CRUD de Contratos e Indicadores

**Frontend Types globais** (`frontend/src/types/index.ts`):
- 12 interfaces: `Perfil`, `Usuario`, `Oss`, `Contrato`, `Unidade`, `Indicador`, `Meta`, `AcompanhamentoMensal`, `DescontoBloco`, `DescontoIndicador`, `RepasseMensal`, `DashboardResumo`

**Frontend CRUD Pages** (cada uma com `types.ts`, `List.tsx`, `FormModal.tsx`, `DeleteModal.tsx`):
- `Oss/` — CRUD Organizações Sociais (`OssRecord`, `mascaraCNPJ`, `validarCNPJ`)
- `Contratos/` — CRUD Contratos de Gestão (`ContratoRecord`, `formatarMoeda`)
- `Unidades/` — CRUD Unidades de Saúde (`UnidadeRecord`, `mascaraCNPJUnidade`)
- `Indicadores/` — CRUD Indicadores com hub por unidade (`IndicadorRecord`, `formatarMeta`)
- `Metas/` — CRUD Metas com `meta_tipo` (`MetaRecord`, `formatarValor`)
- `EntradaMensal/` — Hub + List + Modal de acompanhamento mensal (`AcompanhamentoRecord`, `calcularStatusPreview`)

**Frontend Hook**: `useApi` — `get/post/put/del` + classe `ApiError` (status HTTP tipado)

**Frontend Auth**: `AuthContext` — login real via `POST /api/auth/login`, auto-login em DEV com `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD`

## File Structure & Code Organization

- `src/` — Backend Node.js/Express
  - `config/` — Configuração (Joi validation, database, passport JWT)
  - `controllers/` — Controllers REST (Auth, Acompanhamentos, Contrato, Indicador, Desconto, Meta, Oss, Unidade)
  - `dao/` — Data Access Objects (SuperDao base, AcompanhamentoDao, IndicadorDao)
  - `db/migrations/` — 27+ migrações Sequelize (22 tabelas + campos de snapshot + meta_tipo)
  - `db/seeders/` — Seeds com dados reais de Americana/SP
  - `helper/` — Utilitários (ApiError, EmailHelper, RedisHelper, responseHandler)
  - `middlewares/` — Auth JWT (Passport), RBAC, Auditoria LGPD
  - `models/` — 22 modelos Sequelize (class-based com `init` + `associate`)
  - `route/` — Rotas Express com middleware `auth()` e `authorize([...perfis])`
  - `service/` — Lógica de negócio (descontos, repasses, acompanhamentos, auth)
  - `validator/` — Validação Joi (Acompanhamentos, Indicador, Meta)
- `frontend/` — Frontend React + TypeScript + Vite 8
  - `src/components/ui/` — CardMetrica, TabelaIndicadores, ModalEntradaDados, BotaoAprovar, AlertaDesconto, StatusBadge
  - `src/components/layout/` — Header, ProtectedRoute
  - `src/components/SidebarMenu.tsx` — Sidebar com NAV_ITEMS + MENU_GROUPS (accordion CRUD)
  - `src/pages/` — 14 páginas lazy-loaded:
    - `LoginPage`, `DashboardPage`, `EntradaMensalPage`, `AprovacaoPage`, `RelatoriosCMSPage`, `PerfilOSSPage`
    - `Oss/`, `Contratos/`, `Unidades/`, `Indicadores/`, `Metas/`, `EntradaMensal/`
  - `src/contexts/AuthContext.tsx` — JWT real, RBAC, dark mode, auto-login DEV
  - `src/hooks/useApi.ts` — fetch wrapper com `ApiError`, sem logout em DEV no 401
  - `src/lib/formatters.ts` — moeda, percentual, datas, status
  - `src/data/mock.ts` — mock data (fallback DEV em catches de API)
  - `vite.config.ts` — Vite 8 + Rolldown, `manualChunks`
- `docs/` — Documentação do produto (PRD_v2, ARQUITETURA_v2, banco_v2, erd_v2)
- `specs/` — Testes unitários Jest (acompanhamentos, metas) + specs OpenAPI auth
- `design/` — Design System HTML/JSX (tokens CSS, componentes, tabelas, gráficos)

## Technology Stack Summary

**Backend**: Node.js 22 + Express.js 4 + Sequelize 6 ORM + MySQL 8+. Autenticação via Passport.js + JWT (tabela `tb_usuarios`, campo `senha_hash`). Validação com Joi. Logging com Winston. Cache com Redis. Tarefas agendadas com node-cron. Comunicação bidirecional com Socket.io.

**Frontend**: React 18 + TypeScript + **Vite 8** (Rolldown engine) + Tailwind CSS + Chart.js via react-chartjs-2 + Lucide React + React Router v6. Virtualização de listas com **react-window v2** (API `rowComponent`/`rowCount`/`rowHeight`/`rowProps`). Todas as páginas são lazy-loaded via `React.lazy()` + `Suspense`.

**Infraestrutura**: Docker (compose disponível), XAMPP para desenvolvimento local.

## Core Framework Stack

- **Backend**: Express.js (MVC) → Route → Controller → Service → DAO → Model (Sequelize)
- **Auth flow**: `POST /api/auth/login` → `AuthService` (query `tb_usuarios`) → `TokenService` (JWT `sub=usuario_id`) → `passport.js` (verifica JWT, carrega `Usuario` de `tb_usuarios`)
- **Frontend**: React SPA com Context API para estado global (AuthContext com login real)
  - Roteamento: `ProtectedRoute` por `Perfil[]`, redirecionamento inteligente por perfil
  - Padrão CRUD: `types.ts` → `List.tsx` (react-window v2) → `FormModal.tsx` → `DeleteModal.tsx`
- **Dados**: MySQL 8+ com UUIDs `DEFAULT (UUID())`, soft deletes, tabelas de histórico imutáveis
- **Padrões**: Strategy Pattern para cálculo de descontos (flat vs ponderado), RBAC com 5 perfis de usuário

## UI & Interaction Libraries

- **Tailwind CSS**: Design system com variáveis CSS customizadas (tema azul/saúde, dark/light mode via `[data-theme="dark"]`)
- **Chart.js + react-chartjs-2**: Gráficos de barras e linha no Dashboard
- **Lucide React**: Ícones SVG (tamanho padrão 20px)
- **react-window v2**: Virtualização de tabelas grandes — API `List` com `rowComponent`, `rowCount`, `rowHeight`, `rowProps`, `overscanCount`
- **Acessibilidade**: WCAG 2.1 AA (ARIA labels, `role="table/row/cell/columnheader"`, keyboard navigation, ARIA live regions para toasts)

## Getting Started Checklist

1. Clone o repositório e instale dependências backend: `npm install`
2. Copie `.env.example` para `.env` e configure credenciais MySQL (`DB_NAME=oss`)
3. Crie o banco: `CREATE DATABASE oss;`
4. Execute migrações: `npm run db:migrate`
5. Popule dados iniciais: `npm run db:seed`
6. Inicie o backend: `npm start` (porta 5000)
7. Instale dependências frontend: `cd frontend && npm install`
8. Crie `frontend/.env.development` com `VITE_DEV_EMAIL=admin@americana.sp.gov.br` e `VITE_DEV_PASSWORD=Oss@2026`
9. Inicie o frontend: `cd frontend && npm run dev` (porta 3000 ou 5173)
10. Acesse `http://localhost:3000` — o login automático em DEV usa as credenciais do `.env.development`

## Next Steps

O sistema está em fase MVP com CRUD completo para OSS, Contratos, Unidades, Indicadores e Metas implementados no frontend (mock DEV), e módulo de Entrada Mensal (acompanhamentos) com backend funcional. Próximas prioridades: implementar endpoints backend `GET/POST/PUT/DELETE /api/oss`, `/api/contratos`, `/api/unidades`, `/api/indicadores`; motor de desconto com Strategy Pattern; módulo financeiro (rubricas); consolidações periódicas; geração de relatórios PDF/Excel. Consulte `docs/PRD_v2.md` e `docs/ARQUITETURA_v2.md` para detalhes.
