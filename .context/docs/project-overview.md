---
type: doc
name: project-overview
description: High-level overview of the project, its purpose, and key components
category: overview
generated: 2026-04-13
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
- **Semantic snapshot**: `context({ action: "getMap", section: "all" })`

## Entry Points

- **Backend API**: [`src/app.js`](src/app.js) — servidor Express, porta 5000
- **Frontend SPA**: [`frontend/src/main.tsx`](frontend/src/main.tsx) — React 18 + Vite
- **Migrations**: `src/db/migrations/` — Sequelize CLI
- **Seeders**: `src/db/seeders/` — dados iniciais (2 OSS, 3 contratos, 5 unidades, 28 indicadores)
- **Cron Jobs**: [`src/cronJobs.js`](src/cronJobs.js) — tarefas agendadas (descontos, alertas)

## Key Exports

- **Backend Models**: 22 modelos Sequelize (Oss, Contrato, Unidade, BlocoProducao, Indicador, Meta, AcompanhamentoMensal, DescontoBloco, DescontoIndicador, RepasseMensal, etc.)
- **Backend Services**: AcompanhamentoService (cálculo de descontos e repasses), ContratoService, IndicadorService
- **Backend Controllers**: AcompanhamentoController, ContratoController, IndicadorController, DescontoController, MetaController
- **Frontend Types**: 12 interfaces TypeScript (`Perfil`, `Usuario`, `Oss`, `Contrato`, `Unidade`, `Indicador`, `Meta`, `AcompanhamentoMensal`, `DescontoBloco`, `DescontoIndicador`, `RepasseMensal`, `DashboardResumo`)
- **Frontend Components**: CardMetrica, TabelaIndicadores, ModalEntradaDados, BotaoAprovar, AlertaDesconto

## File Structure & Code Organization

- `src/` — Backend Node.js/Express
  - `config/` — Configuração (Joi validation, database connection)
  - `controllers/` — Controllers REST (Auth, Acompanhamento, Contrato, Indicador, Desconto, Meta)
  - `dao/` — Data Access Objects (SuperDao base, AcompanhamentoDao, IndicadorDao)
  - `db/migrations/` — 25+ migrações Sequelize (22 tabelas, view, stored procedure, trigger)
  - `db/seeders/` — Seeds com dados reais de Americana/SP
  - `helper/` — Utilitários (ApiError, EmailHelper, RedisHelper, responseHandler)
  - `middlewares/` — Auth JWT, RBAC, Auditoria LGPD
  - `models/` — 22 modelos Sequelize (class-based com `init` + `associate`)
  - `route/` — Rotas Express com middleware de autenticação e autorização
  - `service/` — Lógica de negócio (cálculo de descontos, repasses, validações)
  - `validator/` — Validação Joi (Acompanhamento, Indicador, Meta)
- `frontend/` — Frontend React + TypeScript + Vite
  - `src/components/` — Componentes reutilizáveis (ui/ e layout/)
  - `src/pages/` — 6 páginas (Login, Dashboard, EntradaMensal, Aprovação, RelatóriosCMS, PerfilOSS)
  - `src/types/` — Interfaces TypeScript
  - `src/contexts/` — AuthContext (JWT + RBAC)
  - `src/hooks/` — useApi (fetch wrapper)
  - `src/lib/` — Formatadores (moeda, percentual, datas, status)
  - `src/data/` — Mock data para desenvolvimento
- `docs/` — Documentação do produto (PRD_v2, ARQUITETURA_v2, banco_v2, erd_v2)
- `specs/` — Especificações OpenAPI da autenticação

## Technology Stack Summary

**Backend**: Node.js 22 + Express.js 4 + Sequelize 6 ORM + MySQL 8+. Autenticação via Passport.js + JWT. Validação com Joi. Logging com Winston. Cache com Redis. Tarefas agendadas com node-cron. Comunicação bidirecional com Socket.io.

**Frontend**: React 18 + TypeScript + Vite (build tool) + Tailwind CSS (estilização) + Chart.js via react-chartjs-2 (gráficos) + Lucide React (ícones) + React Router v6. Virtualização de tabelas com react-window.

**Infraestrutura**: Docker (compose disponível), XAMPP para desenvolvimento local.

## Core Framework Stack

- **Backend**: Express.js (MVC) → Route → Controller → Service → DAO → Model (Sequelize)
- **Frontend**: React SPA com Context API para estado global (AuthContext)
- **Dados**: MySQL 8+ com UUIDs `DEFAULT (UUID())`, colunas geradas (`GENERATED ALWAYS AS STORED`), soft deletes, tabelas de histórico imutáveis
- **Padrões**: Strategy Pattern para cálculo de descontos (flat vs ponderado), RBAC com 5 perfis

## UI & Interaction Libraries

- **Tailwind CSS**: Design system com variáveis CSS customizadas (tema azul/saúde, dark/light mode)
- **Chart.js + react-chartjs-2**: Gráficos de barras e linha no Dashboard
- **Lucide React**: Ícones SVG
- **react-window**: Virtualização de tabelas grandes (28+ indicadores)
- **Acessibilidade**: WCAG 2.1 AA (ARIA labels, keyboard navigation, contraste semântico)

## Getting Started Checklist

1. Clone o repositório e instale dependências: `npm install`
2. Copie `.env.example` para `.env` e configure credenciais MySQL (`DB_NAME=oss`)
3. Crie o banco: `CREATE DATABASE oss;`
4. Execute migrações: `npm run db:migrate`
5. Popule dados iniciais: `npm run db:seed`
6. Inicie o backend: `npm start` (porta 5000)
7. Instale dependências do frontend: `cd frontend && npm install`
8. Inicie o frontend: `npm run dev` (porta 5173, proxy para API)
9. Acesse `http://localhost:5173` e faça login

## Next Steps

O sistema está em fase MVP. Gaps identificados incluem: implementação do módulo financeiro (rubricas), motor de desconto com Strategy Pattern, consolidações periódicas (trimestral/quadrimestral), geração de relatórios PDF/Excel, e implementação completa dos 8 cron jobs especificados. Consulte `docs/PRD_v2.md` para requisitos detalhados e `docs/ARQUITETURA_v2.md` para a arquitetura alvo.
