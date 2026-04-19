---
type: skill
name: Bug Investigation
description: Investigate bugs systematically and perform root cause analysis. Use when Investigating reported bugs, Diagnosing unexpected behavior, or Finding the root cause of issues
skillSlug: bug-investigation
phases: [E, V]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Reproduzir o bug localmente: `npm start`, acessar `localhost:5173`, login com credenciais dos seeds
2. Verificar logs Winston no backend para stack traces
3. Identificar a camada afetada: DB constraint → Model → Service → Controller → Frontend
4. Para erros de migration: verificar ordem de FKs em `src/db/migrations/` e índices UNIQUE
5. Para erros de cálculo: comparar lógica em `AcompanhamentoService.js` com regras do `docs/PRD_v2.md`
6. Para erros TypeScript: executar `cd frontend && npx tsc --noEmit`
7. Implementar fix mínimo e verificar que não quebra outros fluxos

## Examples

**Bug de FK em migration (caso real):**
```
ERROR: Can't create table `oss`.`tb_acomp_mensal` (errno: 150)

Investigação:
- FK referencia users.uuid mas users.uuid faz parte de PK composta
- MySQL requer índice UNIQUE standalone para FK target

Fix: Criar migration intermediária:
  queryInterface.addIndex('users', ['uuid'], { unique: true, name: 'users_uuid_unique' })
```

**Bug de validação Joi (caso real):**
```
ERROR: Config validation error: "DB_PASS" is not allowed to be empty

Investigação:
- src/config/config.js usa Joi.string().required() para DB_PASS
- XAMPP local usa password vazio por padrão

Fix: Joi.string().allow('').default('')
```

## Quality Bar

- Sempre reproduzir antes de investigar
- Checar `docs/banco_v2.md` para schema correto vs implementado
- Verificar dados dos seeds para testar cenários
- Para bugs financeiros: comparar com valores do PRD (R$10M base, faixas de desconto)
- Nunca alterar migration já executada; criar migration corretiva
- Testar fix com todos os 5 perfis de usuário se bug é de RBAC

## Resource Strategy

- Usar logs Winston existentes para diagnóstico (não adicionar logs temporários sem remover)
- Consultar `docs/erd_v2.md` para entender dependências entre tabelas
- Verificar tabelas de histórico (`tb_hist_*`) se bug envolve versionamento de dados
