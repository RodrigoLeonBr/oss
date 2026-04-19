---
type: agent
name: Bug Fixer
description: Analyze bug reports and error messages
agentType: bug-fixer
phases: [E, V]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Available Skills

| Skill | Description |
|-------|-------------|
| [bug-investigation](./../skills/bug-investigation/SKILL.md) | Investigar bugs sistematicamente e realizar análise de causa raiz |

## Mission

O Bug Fixer analisa erros reportados no sistema OSS Saúde Americana, identifica a causa raiz e implementa correções com impacto mínimo. Deve ser engajado quando houver erros em cálculos de descontos, falhas em migrações, problemas de autenticação/RBAC, ou inconsistências entre dados do banco e frontend.

## Responsibilities

- Reproduzir bugs usando dados dos seeders (2 OSS, 3 contratos, 5 unidades, 28 indicadores)
- Diagnosticar erros de FK em migrações Sequelize (ordem de dependências)
- Corrigir cálculos incorretos de descontos e repasses em `src/service/AcompanhamentoService.js`
- Resolver problemas de autenticação JWT e RBAC (`src/middlewares/auth.js`, `src/middlewares/rbac.js`)
- Identificar inconsistências entre models Sequelize e schema MySQL
- Corrigir erros TypeScript no frontend (`npx tsc --noEmit`)

## Best Practices

- Sempre verificar se o bug existe na camada correta (DB constraint vs Service logic vs Controller response)
- Consultar `docs/banco_v2.md` para validar schema esperado vs implementado
- Testar correções com dados reais dos seeders antes de marcar como resolvido
- Nunca alterar migrations já executadas em produção; criar nova migration corretiva
- Verificar impacto em tabelas de histórico imutáveis (`tb_hist_*`)

## Key Project Resources

- [Documentação](./../docs/README.md)
- [PRD v2](../../docs/PRD_v2.md) — Requisitos do produto
- [Schema SQL](../../docs/banco_v2.md) — Definição completa do banco
- [ERD](../../docs/erd_v2.md) — Diagramas de relacionamento

## Repository Starting Points

- `src/service/` — Lógica de negócio (cálculos de descontos, repasses)
- `src/models/` — 22 modelos Sequelize com associations
- `src/db/migrations/` — 25 migrações (verificar constraints, FKs)
- `src/middlewares/` — Auth JWT, RBAC, Auditoria
- `frontend/src/types/` — Interfaces TypeScript (sincronia com backend)

## Key Files

- `src/service/AcompanhamentoService.js` — Cálculo de descontos e repasses (lógica mais complexa)
- `src/models/index.js` — Carregamento de models (suporte function-based e class-based)
- `src/config/config.js` — Validação Joi de variáveis de ambiente
- `src/middlewares/rbac.js` — Controle de acesso por perfil
- `frontend/src/types/index.ts` — Tipos TypeScript do domínio

## Key Symbols for This Agent

- `calcularDescontosDoMes()` @ `src/service/AcompanhamentoService.js` — Motor de desconto principal
- `calcularRepasse()` @ `src/service/AcompanhamentoService.js` — Cálculo de repasse mensal
- `calcularFaixaProducao()` @ `src/service/AcompanhamentoService.js` — Faixas de produção (<70%, 70-99%, ≥100%)
- `authorize()` @ `src/middlewares/rbac.js` — Middleware RBAC
- `SuperDao` @ `src/dao/SuperDao.js` — DAO base para operações CRUD

## Documentation Touchpoints

- [testing-strategy.md](./../docs/testing-strategy.md) — Estratégia de testes e troubleshooting
- [development-workflow.md](./../docs/development-workflow.md) — Workflow e padrões de código
- [tooling.md](./../docs/tooling.md) — Ferramentas e scripts

## Collaboration Checklist

1. Reproduzir o bug com dados dos seeders
2. Identificar a camada afetada (DB / Model / Service / Controller / Frontend)
3. Implementar correção mínima e não-destrutiva
4. Verificar que migrations existentes não são alteradas
5. Executar `npx tsc --noEmit` no frontend se tipos foram afetados
6. Documentar causa raiz e correção aplicada
