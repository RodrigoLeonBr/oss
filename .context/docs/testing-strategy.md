---
type: doc
name: testing-strategy
description: Test frameworks, patterns, coverage requirements, and quality gates
category: testing
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Testing Strategy

A qualidade do sistema OSS é mantida por uma combinação de validação em múltiplas camadas: validação Joi na entrada da API, constraints MySQL no banco (CHECK, FOREIGN KEY, UNIQUE), cálculos verificáveis nos services, e verificação de tipos TypeScript no frontend. A estratégia de testes está sendo expandida para cobrir testes unitários, de integração e E2E.

## Test Types

- **Unit**: Jest (configurado via `npm test`), arquivos nomeados `*.test.js` / `*.spec.js`
  - Foco em: Services (cálculo de descontos, repasses, faixas de produção), Validators (schemas Joi), Helpers
  - Mocking: Sequelize models mockados para isolar lógica de negócio
- **Integration**: Supertest + Jest para testar endpoints REST completos
  - Cenários: CRUD de contratos, ciclo completo de acompanhamento mensal, fluxo de aprovação
  - Banco: Usar banco de teste separado (`oss_test`) com migrações aplicadas
- **E2E**: Planejado com Cypress ou Playwright para o frontend
  - Cenários prioritários: Login → Dashboard → Entrada Mensal → Aprovação
- **TypeScript**: `npx tsc --noEmit` no frontend para verificação estática de tipos
- **Specs existentes**: `specs/Authentication/` contém especificações da API de autenticação

## Running Tests

- **Todos os testes**: `npm test`
- **Watch mode**: `npm test -- --watch`
- **Coverage**: `npm test -- --coverage`
- **TypeScript check (frontend)**: `cd frontend && npx tsc --noEmit`
- **Lint**: `npm run lint` (se configurado)
- **Migrações (validação)**: `npm run db:migrate` seguido de `npm run db:migrate:undo:all` e re-migrate

## Quality Gates

- **Cobertura mínima**: 70% para services e validators (alvo: 85%)
- **TypeScript**: Zero erros em `tsc --noEmit` obrigatório antes de merge
- **Migrações**: Toda migration deve ter `down` funcional e testado
- **Validação Joi**: Todo endpoint POST/PUT deve ter validator correspondente
- **RBAC**: Testes devem verificar que perfis não autorizados recebem 403
- **Cálculos financeiros**: Testes com valores reais do PRD (ex: base R$10M, descontos por faixa)
- **Dados sensíveis**: Verificar que CPF e dados pessoais não aparecem em logs ou respostas não autorizadas

## Troubleshooting

- **Erro de FK em migrations**: Verificar ordem de criação de tabelas e presença de índices únicos nas colunas referenciadas (ex: `users.uuid` precisa de índice UNIQUE standalone)
- **Seeds falhando**: Seeds dependem da ordem de execução; usar `npm run db:seed:undo` antes de re-executar
- **TypeScript errors após mudança de schema**: Atualizar `frontend/src/types/index.ts` e `frontend/src/data/mock.ts` simultaneamente
- **PowerShell**: Usar `;` ao invés de `&&` para encadear comandos no Windows PowerShell
