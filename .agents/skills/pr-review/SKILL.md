---
name: pr-review
description: Review pull requests against team standards and best practices. Use when Reviewing a pull request before merge, Providing feedback on proposed changes, or Validating PR meets project standards
---

## Workflow

1. Ler descrição da PR e issue linkada
2. Verificar que alterações seguem padrão de camadas MVC
3. Checar migrações: têm `up` e `down`? Ordem de FK correta?
4. Validar RBAC: rotas novas com `auth()` + `authorize()`
5. Confirmar validação Joi para endpoints de escrita
6. Verificar tipos TypeScript atualizados se schema mudou
7. Executar `npx tsc --noEmit` no frontend
8. Aprovar, solicitar mudanças ou comentar

## Examples

**Aprovação com sugestão:**
```
Implementação limpa seguindo o padrão de camadas.

Sugestão menor: extrair a lógica de validação de faixa de produção
em AcompanhamentoService.js:96 para uma função utilitária, pois
é reutilizada em calcularRepasse() também.

Aprovado ✅
```

**Solicitação de mudanças:**
```
Bom progresso, mas alguns itens precisam de atenção:

1. A rota POST /api/rubricas está sem authorize() — apenas admin
   e gestor_sms devem poder criar rubricas
2. Migration 20260413000026 não tem função down() implementada
3. Falta validação Joi para o campo valor_previsto
4. Interface TypeScript em frontend/src/types/index.ts precisa
   incluir o novo tipo Rubrica

Por favor corrija e reenvie.
```

## Quality Bar

- Começar entendendo o objetivo da PR
- Distinguir entre mudanças obrigatórias e sugestões
- Testar localmente se mudanças são complexas
- Verificar impacto em conformidade LGPD/TCESP
- Confirmar backward compatibility
- Checar que seeds são atualizados se schema mudou
- Verificar que tabelas `tb_hist_*` não recebem UPDATE

## Resource Strategy

- Usar `docs/ARQUITETURA_v2.md` como referência de padrões esperados
- Consultar `docs/banco_v2.md` para validar migrations contra spec
- Não criar checklists separados; manter inline nesta skill
