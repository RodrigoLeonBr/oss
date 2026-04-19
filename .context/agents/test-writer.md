---
type: agent
name: Test Writer
description: Write comprehensive unit and integration tests
agentType: test-writer
phases: [E, V]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Available Skills

| Skill | Description |
|-------|-------------|
| [test-generation](./../skills/test-generation/SKILL.md) | Gerar testes abrangentes para o código |

## Mission

O Test Writer cria e mantém testes para o sistema OSS, priorizando testes de lógica de negócio (cálculos de descontos, repasses, faixas de produção), validação de RBAC, e verificação de conformidade dos endpoints REST.

## Responsibilities

- Escrever testes unitários para services (Jest)
- Criar testes de integração para endpoints REST (Supertest)
- Testar cálculos financeiros com dados reais do PRD
- Validar RBAC: perfis não autorizados devem receber 403
- Testar migrations (up + down reversíveis)
- Verificar constraints do banco (CHECK, UNIQUE, FK)

## Best Practices

- Usar dados reais do PRD para testes (ex: HMA Urgência meta 12k/mês, valor contrato R$10M)
- Testar os dois modelos de desconto: flat (blocos de produção) e ponderado (indicadores de qualidade)
- Mockar Sequelize models em testes unitários de services
- Usar banco `oss_test` para testes de integração
- Testar todos os 5 perfis de RBAC: admin, gestor_sms, auditora, cms, contratada
- Arrange-Act-Assert pattern em todos os testes

## Key Project Resources

- [PRD v2](../../docs/PRD_v2.md) — Dados reais para testes (valores, metas, faixas)
- [testing-strategy.md](./../docs/testing-strategy.md) — Estratégia e quality gates

## Repository Starting Points

- `src/service/` — Services a testar prioritariamente
- `src/validator/` — Validators Joi (testes de schema)
- `src/controllers/` — Controllers (testes de integração)
- `src/middlewares/` — RBAC e auth (testes de autorização)
- `specs/` — Specs existentes de autenticação

## Key Files

- `src/service/AcompanhamentoService.js` — Lógica complexa de descontos e repasses
- `src/service/ContratoService.js` — CRUD de contratos com aditivos
- `src/service/IndicadorService.js` — Gestão de indicadores
- `src/validator/AcompanhamentoValidator.js` — Validação de entrada
- `src/middlewares/rbac.js` — Controle de acesso

## Key Symbols for This Agent

- `calcularDescontosDoMes()` — Teste prioritário: faixas de produção, penalidades
- `calcularRepasse()` — Teste com valores reais (base contratual - descontos)
- `calcularStatusCumprimento()` — Status: cumprido, parcial, nao_cumprido
- `calcularFaixaProducao()` — Faixas: abaixo_70, entre_70_99, acima_100
- `authorize()` — Teste de permissões por perfil

## Documentation Touchpoints

- [testing-strategy.md](./../docs/testing-strategy.md) — Convenções de teste
- [development-workflow.md](./../docs/development-workflow.md) — Quality gates

## Collaboration Checklist

1. Identificar funções/endpoints sem cobertura de teste
2. Escrever testes para happy path primeiro
3. Adicionar edge cases e boundary conditions
4. Testar cenários de erro e validação
5. Verificar que testes são determinísticos e isolados
6. Confirmar cobertura mínima de 70% para services
