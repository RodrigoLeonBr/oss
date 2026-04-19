---
name: code-review
description: Review code quality, patterns, and best practices. Use when Reviewing code changes for quality, Checking adherence to coding standards, or Identifying potential bugs or issues
---

## Workflow

1. Verificar conformidade com padrão de camadas: Route → Controller → Service → DAO → Model
2. Checar que Controller não contém lógica de negócio (deve estar no Service)
3. Confirmar validação Joi em todos os endpoints POST/PUT
4. Verificar RBAC: `auth()` + `authorize([...perfis])` em toda rota
5. Checar que migrations têm `down` funcional
6. Validar que UUIDs são usados (não auto-increment IDs expostos)
7. Verificar conformidade LGPD: auditoria em ações sensíveis, sem PII em logs do frontend

## Examples

**Checklist para nova rota:**
```javascript
// CORRETO: Camadas separadas, RBAC, validação
router.post('/',
  auth(),
  authorize(['admin', 'gestor_sms']),
  AcompanhamentoValidator.criar,  // Joi validation
  auditoria('criar_acompanhamento'),
  ctrl.criarOuAtualizar
);

// INCORRETO: Sem validação, sem RBAC, lógica no controller
router.post('/', auth(), async (req, res) => {
  const result = await Model.create(req.body); // Lógica no route!
  res.json(result);
});
```

**Checklist para model:**
```javascript
// CORRETO: Class-based com init + associate
class Contrato extends Model {
  static init(sequelize) {
    super.init({ /* campos */ }, { sequelize, tableName: 'tb_contratos', paranoid: true });
  }
  static associate(models) {
    this.belongsTo(models.Oss, { foreignKey: 'oss_id' });
  }
}
```

## Quality Bar

- Separação de camadas respeitada (Controller → Service → DAO)
- Validação Joi em todo input de API
- RBAC configurado com perfis corretos do domínio
- Migrações reversíveis (up + down)
- UUIDs como identificadores públicos
- Soft deletes com `paranoid: true`
- Tabelas de histórico não recebem UPDATE/DELETE
- TypeScript: zero erros em `tsc --noEmit`
- Sem dados sensíveis (CPF) em logs de frontend ou localStorage

## Resource Strategy

- Consultar `docs/ARQUITETURA_v2.md` como referência de padrões alvo
- Usar `docs/banco_v2.md` para validar schema implementado vs especificado
- Não criar checklists extras; manter critérios inline nesta skill
