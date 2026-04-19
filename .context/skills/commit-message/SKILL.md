---
type: skill
name: Commit Message
description: Generate commit messages that follow conventional commits and repository scope conventions. Use when Creating git commits after code changes, Writing commit messages for staged changes, or Following conventional commit format for the project
skillSlug: commit-message
phases: [E, C]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Executar `git diff --staged` para ver alterações
2. Identificar tipo: feat, fix, refactor, chore, docs, test, perf
3. Determinar escopo usando módulos do projeto: `db`, `api`, `auth`, `acompanhamento`, `contrato`, `indicador`, `desconto`, `meta`, `frontend`, `cron`
4. Escrever subject line imperativo em inglês (max 50 chars)
5. Adicionar body em português se necessário (explicar "por quê")

## Examples

**Feature de novo endpoint:**
```
feat(api): add monthly consolidation endpoint

Implementa consolidação trimestral/quadrimestral de indicadores
conforme PRD v2 seção 6.4.

Refs: docs/PRD_v2.md
```

**Migration de banco:**
```
chore(db): create tb_rubricas and tb_exec_financeira tables

Adiciona tabelas do módulo financeiro (rubricas e execução
financeira) conforme banco_v2.md.
```

**Fix de cálculo:**
```
fix(desconto): correct production threshold calculation

Faixa de produção <70% deve aplicar 30% de desconto no bloco,
não 30% do valor total do contrato.

Fixes #42
```

**Atualização frontend:**
```
feat(frontend): add financial module page and types

Adiciona página de gestão de rubricas e tipos TypeScript
correspondentes ao módulo financeiro.
```

## Quality Bar

- Imperativo: "add" não "added" ou "adds"
- Subject max 50 chars, sem ponto final
- Escopos válidos: `db`, `api`, `auth`, `acompanhamento`, `contrato`, `indicador`, `desconto`, `meta`, `frontend`, `cron`, `docs`, `config`
- Body explica "por quê", não "o quê" (o diff mostra o quê)
- Referenciar seções do PRD ou banco_v2 quando relevante
- Um commit por mudança lógica

## Resource Strategy

- Não criar hooks de commit adicionais por enquanto
- Manter convenção documentada nesta skill como referência única
