---
type: doc
name: testing-strategy
description: Test frameworks, patterns, coverage requirements, and quality gates
category: testing
generated: 2026-04-19
status: filled
scaffoldVersion: "2.0.0"
---

## Testing Strategy

A qualidade do sistema OSS é mantida por uma combinação de validação em múltiplas camadas: validação Joi na entrada da API, constraints MySQL no banco (CHECK, FOREIGN KEY, UNIQUE), cálculos verificáveis nos services, verificação de tipos TypeScript no frontend, e validação client-side nos modais CRUD. A estratégia de testes está sendo expandida para cobrir testes unitários, de integração e E2E.

## Test Types

- **Unit**: Jest (configurado via `npm test`), arquivos nomeados `*.test.js` / `*.spec.js`
  - Foco em: Services (cálculo de descontos, repasses, faixas de produção), Validators (schemas Joi), Helpers
  - Mocking: Sequelize models mockados para isolar lógica de negócio
- **Integration**: Supertest + Jest para testar endpoints REST completos
  - Cenários: CRUD de contratos, CRUD de OSS, ciclo completo de acompanhamento mensal, fluxo de aprovação
  - Banco: Usar banco de teste separado (`oss_test`) com migrações aplicadas
- **E2E**: Planejado com Cypress ou Playwright para o frontend
  - Cenários prioritários: Login → Dashboard → `/oss` (CRUD) → `/contratos` (CRUD) → Entrada Mensal → Aprovação
- **TypeScript**: `npx tsc --noEmit` no frontend — **zero erros obrigatório antes de merge**
- **Specs existentes**: `specs/Authentication/` contém especificações da API de autenticação

## Validação Client-Side (CRUD Frontend)

Os modais de formulário CRUD implementam validação client-side antes de chamar a API:

- **OSS (`OssFormModal.tsx`)**: `nome` obrigatório, `cnpj` obrigatório + algoritmo dígitos verificadores, `email` regex. Durante edição, a validação do CNPJ pula os dígitos se o valor não foi alterado.
- **Contratos (`ContratosFormModal.tsx`)**: `ossId` obrigatório, `numeroContrato` obrigatório (mín. 3 chars), `periodoInicio`/`periodoFim` obrigatórios (fim > início), `valorMensal` obrigatório (> 0), `percentualDesconto` opcional (0–100).

## Running Tests

- **Todos os testes**: `npm test`
- **Watch mode**: `npm test -- --watch`
- **Coverage**: `npm test -- --coverage`
- **TypeScript check (frontend)**: `cd frontend && npx tsc --noEmit`
- **Build completo**: `npm run build` (tsc + vite build via Rolldown — valida tipos e bundle)
- **Lint**: `npm run lint` (se configurado)
- **Migrações (validação)**: `npm run db:migrate` seguido de `npm run db:migrate:undo:all` e re-migrate

## Quality Gates

- **Cobertura mínima**: 70% para services e validators (alvo: 85%)
- **TypeScript**: Zero erros em `tsc --noEmit` obrigatório antes de merge
- **Build limpo**: `npm run build` sem erros (inclui TypeScript + Rolldown)
- **Migrações**: Toda migration deve ter `down` funcional e testado
- **Validação Joi**: Todo endpoint POST/PUT deve ter validator correspondente
- **RBAC**: Testes devem verificar que perfis não autorizados recebem 403
- **Cálculos financeiros**: Testes com valores reais do PRD (ex: base R$10M, descontos por faixa)
- **Dados sensíveis**: Verificar que CPF e dados pessoais não aparecem em logs ou respostas não autorizadas

## Troubleshooting

- **Erro de FK em migrations**: Verificar ordem de criação de tabelas e presença de índices únicos nas colunas referenciadas
- **Seeds falhando**: Seeds dependem da ordem de execução; usar `npm run db:seed:undo` antes de re-executar
- **TypeScript errors após mudança de schema**: Atualizar `frontend/src/types/index.ts` e `frontend/src/pages/<Entidade>/types.ts` simultaneamente
- **PowerShell**: Usar `;` ao invés de `&&` para encadear comandos no Windows PowerShell
- **`TS1294 erasableSyntaxOnly`**: Não usar parameter properties em construtores — ver `tooling.md`
- **`401` → redirect login em DEV**: `useApi` está configurado para não chamar `logout()` em DEV; verificar que `import.meta.env.DEV` é `true` e que o `catch` do componente tem o fallback mock
- **Mock CNPJ inválido**: Os `mockOssRecords` usam CNPJs matematicamente válidos (`04.364.900/0001-79`, `62.173.620/0001-80`). Ao adicionar novos mocks, valide os dígitos verificadores
