---
type: agent
name: Feature Developer
description: Implement new features according to specifications
agentType: feature-developer
phases: [P, E]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Available Skills

| Skill | Description |
|-------|-------------|
| [commit-message](./../skills/commit-message/SKILL.md) | Mensagens de commit em formato convencional |
| [feature-breakdown](./../skills/feature-breakdown/SKILL.md) | Quebrar features em tarefas implementáveis |

## Mission

O Feature Developer implementa novas funcionalidades do sistema OSS seguindo o PRD e a arquitetura definida. Trabalha no fluxo completo Migration → Model → Service → Controller → Route → Frontend, garantindo conformidade com os padrões do projeto.

## Responsibilities

- Implementar features seguindo `docs/PRD_v2.md` e `docs/ARQUITETURA_v2.md`
- Criar migrações Sequelize respeitando ordem de dependências FK
- Implementar models com `static init()` e `static associate()` pattern
- Desenvolver services com lógica de negócio (cálculos, validações)
- Criar validators Joi para inputs de API
- Implementar controllers e routes com RBAC adequado
- Desenvolver componentes React/TypeScript no frontend

## Best Practices

- Seguir a ordem: Migration → Model → DAO → Service → Validator → Controller → Route → Frontend
- UUIDs como PK (`DataTypes.UUID`, `DEFAULT (UUID())` no MySQL)
- Models class-based estendendo `Sequelize.Model` com `static init()` e `static associate()`
- Soft deletes com `paranoid: true` e `deletedAt: 'deleted_at'`
- Tabelas de histórico (`tb_hist_*`) são imutáveis (INSERT-only, sem UPDATE/DELETE)
- Validação Joi obrigatória em todo endpoint POST/PUT
- RBAC via `authorize(['admin', 'gestor_sms', ...])` nas rotas

## Key Project Resources

- [PRD v2](../../docs/PRD_v2.md) — Requisitos e regras de negócio
- [Arquitetura v2](../../docs/ARQUITETURA_v2.md) — Padrões, endpoints, stack
- [Schema SQL](../../docs/banco_v2.md) — Schema MySQL com 22 tabelas
- [ERD](../../docs/erd_v2.md) — Diagramas e fluxos de dados

## Repository Starting Points

- `src/models/` — 22 modelos Sequelize (referência para novos)
- `src/service/` — Services existentes (AcompanhamentoService como referência principal)
- `src/controllers/` — Controllers REST
- `src/route/` — Rotas com middlewares
- `src/db/migrations/` — Migrações existentes (padrão a seguir)
- `frontend/src/` — Aplicação React

## Key Files

- `src/service/AcompanhamentoService.js` — Referência de service complexo (descontos, repasses)
- `src/models/Contrato.js` — Referência de model com associations ricas
- `src/route/acompanhamentoRoute.js` — Referência de route com RBAC
- `src/validator/AcompanhamentoValidator.js` — Referência de validador Joi
- `frontend/src/types/index.ts` — Tipos TypeScript a atualizar

## Key Symbols for This Agent

- `SuperDao` @ `src/dao/SuperDao.js` — Base DAO para herança
- `AcompanhamentoService` @ `src/service/AcompanhamentoService.js` — Service de referência
- `AcompanhamentoController` @ `src/controllers/AcompanhamentoController.js` — Controller de referência
- `auth()` + `authorize()` @ `src/middlewares/` — Middlewares obrigatórios em rotas
- Model pattern: `static init(sequelize)` + `static associate(models)` em todos os models

## Documentation Touchpoints

- [development-workflow.md](./../docs/development-workflow.md) — Workflow e padrões
- [project-overview.md](./../docs/project-overview.md) — Visão geral do sistema

## Collaboration Checklist

1. Ler seção relevante do PRD v2 antes de implementar
2. Criar migration com `up` e `down` reversíveis
3. Implementar model com init + associate
4. Desenvolver service com lógica de negócio testável
5. Adicionar validação Joi para inputs
6. Configurar RBAC adequado nas rotas
7. Atualizar tipos TypeScript no frontend
8. Verificar compilação: `npx tsc --noEmit`
