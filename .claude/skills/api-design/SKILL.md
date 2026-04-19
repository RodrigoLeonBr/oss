---
name: api-design
description: Design RESTful APIs following best practices. Use when Designing new API endpoints, Restructuring existing APIs, or Planning API versioning strategy
---

## Workflow

1. Consultar `docs/ARQUITETURA_v2.md` para verificar endpoints já especificados (~50 endpoints REST)
2. Seguir padrão existente: `src/route/<recurso>Route.js` → `src/controllers/<Recurso>Controller.js`
3. Aplicar middlewares na ordem: `auth()` → `authorize([...perfis])` → `auditoria('ação')` → handler
4. Definir request/response schemas com Joi em `src/validator/`
5. Usar UUIDs em URLs (nunca IDs sequenciais): `/api/contratos/:contrato_id`
6. Retornar respostas padronizadas via `src/helper/responseHandler.js`
7. Registrar nova rota em `src/route/index.js`

## Examples

**Padrão de rotas OSS:**
```javascript
// src/route/contratoRoute.js
const router = require('express').Router();
const auth = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const ContratoController = require('../controllers/ContratoController');

const ctrl = new ContratoController();

router.get('/', auth(), authorize(['admin','gestor_sms','auditora','cms']), ctrl.listar);
router.get('/:id', auth(), ctrl.buscarPorId);
router.post('/', auth(), authorize(['admin','gestor_sms']), ctrl.criar);
router.put('/:id', auth(), authorize(['admin','gestor_sms']), ctrl.atualizar);
router.post('/:id/aditivos', auth(), authorize(['admin','gestor_sms']), ctrl.adicionarAditivo);

module.exports = router;
```

**Resposta padronizada:**
```json
{
  "success": true,
  "data": { "contrato_id": "uuid-...", "numero_contrato": "SCMC 009/2023" },
  "meta": { "page": 1, "totalPages": 1, "total": 3 }
}
```

**Erro padronizado:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "valor_mensal_previsto é obrigatório",
    "details": [...]
  }
}
```

## Quality Bar

- Toda rota protegida com `auth()` (JWT obrigatório)
- RBAC definido: quais perfis acessam cada endpoint
- Validação Joi antes de processar request
- UUIDs em todos os parâmetros de URL e respostas
- Soft delete via `DELETE /recurso/:id` (marca `deleted_at`, não remove)
- Auditoria LGPD via middleware `auditoria()` em ações sensíveis
- Respostas paginadas para listagens (offset/limit)

## Resource Strategy

- Manter validators como arquivos separados em `src/validator/` (reutilizáveis entre routes)
- Não criar helpers extras; usar `responseHandler.js` e `ApiError.js` existentes
- Documentar endpoints em `docs/ARQUITETURA_v2.md` quando criados
