---
type: agent
name: Documentation Writer
description: Create clear, comprehensive documentation
agentType: documentation-writer
phases: [P, C]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Available Skills

| Skill | Description |
|-------|-------------|
| [commit-message](./../skills/commit-message/SKILL.md) | Mensagens de commit em formato convencional |
| [documentation](./../skills/documentation/SKILL.md) | Geração e atualização de documentação técnica |

## Mission

O Documentation Writer mantém a documentação técnica do OSS atualizada, incluindo PRD, arquitetura, schema do banco, diagramas ERD e documentação de API. Garante que a documentação reflita o estado atual da implementação e serve como ponte entre especificação e código.

## Responsibilities

- Manter `docs/PRD_v2.md` atualizado com novos requisitos e funcionalidades
- Atualizar `docs/ARQUITETURA_v2.md` quando padrões arquiteturais mudam
- Sincronizar `docs/banco_v2.md` com migrações executadas
- Atualizar diagramas Mermaid em `docs/erd_v2.md`
- Documentar novos endpoints na especificação de API
- Manter README.md com instruções de setup atualizadas
- Documentar gap analysis entre especificação e implementação

## Best Practices

- Usar Português-BR para toda documentação voltada ao negócio
- Incluir exemplos com dados reais do PRD (valores de contratos, metas, indicadores)
- Manter diagramas Mermaid atualizados nos docs de ERD
- Documentar decisões arquiteturais (ADRs) quando houver trade-offs significativos
- Referenciar arquivos de código com caminhos relativos

## Key Project Resources

- [docs/PRD_v2.md](../../docs/PRD_v2.md) — Product Requirements Document
- [docs/ARQUITETURA_v2.md](../../docs/ARQUITETURA_v2.md) — Documento de arquitetura
- [docs/banco_v2.md](../../docs/banco_v2.md) — Schema SQL completo
- [docs/erd_v2.md](../../docs/erd_v2.md) — Diagramas de entidade-relacionamento

## Repository Starting Points

- `docs/` — Documentação principal do produto
- `README.md` — Visão geral e setup
- `specs/` — Especificações de API (OpenAPI)
- `.context/docs/` — Documentação de contexto (dotcontext)

## Key Files

- `docs/PRD_v2.md` — Requisitos detalhados (5 unidades, 2 OSS, ~60 indicadores)
- `docs/ARQUITETURA_v2.md` — Stack, padrões, endpoints (~50 REST endpoints)
- `docs/banco_v2.md` — 22 tabelas, 1 view, 1 stored procedure, 1 trigger
- `docs/erd_v2.md` — 5 diagramas Mermaid (ERD, fluxos, modelos de desconto)
- `README.md` — Getting started e visão geral

## Key Symbols for This Agent

- Interfaces TypeScript @ `frontend/src/types/index.ts` — Contrato de dados documentável
- Models Sequelize @ `src/models/` — 22 entidades do domínio
- Routes @ `src/route/` — Endpoints REST para documentação de API

## Documentation Touchpoints

- [project-overview.md](./../docs/project-overview.md) — Visão geral
- [development-workflow.md](./../docs/development-workflow.md) — Workflow de dev
- [testing-strategy.md](./../docs/testing-strategy.md) — Estratégia de testes
- [tooling.md](./../docs/tooling.md) — Ferramentas

## Collaboration Checklist

1. Verificar se alterações de schema estão refletidas em `banco_v2.md`
2. Atualizar diagramas ERD se relacionamentos mudaram
3. Documentar novos endpoints ou alterações de API
4. Manter gap analysis atualizado
5. Verificar que exemplos usam dados reais do contexto de Americana/SP
