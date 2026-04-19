---
type: doc
name: development-workflow
description: Day-to-day engineering processes, branching, and contribution guidelines
category: workflow
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Development Workflow

O fluxo de desenvolvimento segue o padrão MVC em camadas. Para adicionar funcionalidades, o desenvolvedor deve trabalhar na seguinte ordem: Migration → Model → DAO → Service → Validator → Controller → Route. Cada camada tem responsabilidade definida e não deve acessar camadas não adjacentes (ex: Controller nunca acessa DAO diretamente).

O ciclo típico de uma feature envolve:
1. Criar migration Sequelize para alterações no schema MySQL
2. Criar/atualizar o Model Sequelize correspondente
3. Adicionar lógica de negócio no Service
4. Criar validação Joi no Validator
5. Expor via Controller e registrar a Route
6. Atualizar tipos TypeScript no frontend (`frontend/src/types/index.ts`)
7. Criar/atualizar componentes React correspondentes

## Branching & Releases

- **Modelo**: Feature branches a partir de `main`
- **Convenção de branch**: `feature/<nome>`, `fix/<nome>`, `chore/<nome>`
- **Merge**: Via Pull Request com revisão obrigatória
- **Tags**: Semantic versioning (`v1.0.0`, `v1.1.0`, etc.)
- **Ambiente**: Desenvolvimento local com XAMPP (MySQL) + Node.js

## Local Development

- **Instalar dependências backend**: `npm install`
- **Instalar dependências frontend**: `cd frontend && npm install`
- **Configurar ambiente**: `cp .env.example .env` (editar DB_HOST, DB_NAME, DB_USER, DB_PASS)
- **Criar banco**: `mysql -u root -e "CREATE DATABASE oss;"`
- **Executar migrações**: `npm run db:migrate`
- **Desfazer migrações**: `npm run db:migrate:undo`
- **Popular dados**: `npm run db:seed`
- **Iniciar backend**: `npm start` (porta 5000)
- **Iniciar frontend**: `cd frontend && npm run dev` (porta 5173)
- **Build frontend**: `cd frontend && npm run build`
- **TypeScript check**: `cd frontend && npx tsc --noEmit`

## Code Review Expectations

Toda alteração deve passar por revisão antes do merge. O checklist inclui:

- **Conformidade arquitetural**: Respeitar a separação de camadas (Route → Controller → Service → DAO → Model)
- **Migrações reversíveis**: Toda migration deve ter `up` e `down` funcionais
- **Validação**: Inputs de API validados com Joi antes de chegar ao Service
- **RBAC**: Rotas protegidas com `auth()` e `authorize([...perfis])` adequados
- **LGPD/Auditoria**: Ações sensíveis logadas via middleware `auditoria`
- **Tipos frontend**: Interfaces TypeScript atualizadas quando schema muda
- **Sem PII no frontend**: Dados pessoais não expostos em localStorage ou logs do cliente
- **UUIDs**: Chaves primárias usam UUID v4, nunca IDs sequenciais expostos

## Onboarding Tasks

1. Leia `docs/PRD_v2.md` para entender o domínio (contratos de gestão, indicadores, descontos)
2. Leia `docs/ARQUITETURA_v2.md` para entender o stack e padrões
3. Explore `docs/banco_v2.md` e `docs/erd_v2.md` para o schema do banco
4. Execute o setup local completo (migrações + seeds)
5. Navegue pelo frontend e entenda os 5 perfis de usuário (admin, gestor_sms, auditora, cms, contratada)
6. Consulte `testing-strategy.md` e `tooling.md` para ferramentas e testes
