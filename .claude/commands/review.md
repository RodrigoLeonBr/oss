---
description: Revisa o diff atual contra as regras do projeto
---

Revise as mudanças **não commitadas** (`git diff` + `git diff --staged`) deste repositório.

Cheque, nesta ordem:

1. **Segurança** (`.claude/rules/security.md`): toda rota nova tem `auth()` + `checkPermission(modulo, action)`? Writes têm `auditar(...)`? Endpoints com escopo propagam `ossIdFiltro` e validam posse com `assert*NoEscopoOSS`? Nenhum dado sensível versionado?
2. **API** (`.claude/rules/api.md`): respeita Route→Controller→Service→DAO? Resposta `{ status, data, message }`? Erros via `ApiError`/`next(e)`? Validação Joi no controller?
3. **Testing** (`.claude/rules/testing.md`): lógica não-trivial tem check runnable (mocha, não Jest)? `tsc --noEmit` passa no frontend?
4. **Code style** (`.claude/rules/code-style.md`): português, models snake_case, gotchas de React.

Saída: uma linha por achado — `arquivo:linha — problema — correção`. Sem elogios, sem resumo. Nada a corrigir → diga "limpo".
