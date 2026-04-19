---
name: refactoring
description: Refactor code safely with a step-by-step approach. Use when Improving code structure without changing behavior, Reducing code duplication, or Simplifying complex logic
---

## Workflow

1. Identificar code smell ou padrão inconsistente no codebase OSS
2. Verificar se existe cobertura de teste para o código alvo
3. Fazer uma mudança por commit (ex: extrair função, renomear, mover)
4. Executar testes após cada mudança: `npm test`
5. Verificar tipos: `cd frontend && npx tsc --noEmit`
6. Confirmar que migrations e seeds continuam funcionando

## Examples

**Extrair Strategy Pattern para descontos (refatoração prioritária):**
```javascript
// ANTES: Lógica inline em AcompanhamentoService.js
async calcularDescontosDoMes(contratoId, mesRef) {
  // 200+ linhas de lógica misturando flat e ponderado
}

// DEPOIS: Strategy Pattern
// src/service/desconto/DescontoServiceFactory.js
class DescontoServiceFactory {
  static criar(modeloDesconto) {
    if (modeloDesconto === 'flat') return new DescontoFlatService();
    if (modeloDesconto === 'ponderado') return new DescontoPonderadoService();
    throw new ApiError(400, `Modelo de desconto desconhecido: ${modeloDesconto}`);
  }
}

// src/service/desconto/DescontoFlatService.js
class DescontoFlatService {
  calcular(bloco, acompanhamentos) {
    // Lógica específica de desconto flat por bloco de produção
  }
}
```

**Padronizar DAOs:**
```javascript
// ANTES: DAO customizado com queries duplicadas
class IndicadorDao {
  async listar() { /* query manual */ }
}

// DEPOIS: Herdar de SuperDao
class IndicadorDao extends SuperDao {
  constructor() { super('Indicador'); }
  // Apenas métodos específicos que SuperDao não cobre
}
```

## Quality Bar

- Nunca refatorar sem testes existentes ou adicionando testes primeiro
- Um tipo de mudança por commit (não misturar rename + extract + move)
- Manter backward compatibility de API
- Migrations e seeds devem continuar funcionando
- TypeScript zero erros após refatoração frontend
- Priorizar refatorações que desbloqueiam features do PRD

## Resource Strategy

- Não criar arquivos auxiliares; manter procedimento nesta skill
- Consultar `docs/ARQUITETURA_v2.md` para padrões alvo (Strategy, Factory)
- Usar `src/dao/SuperDao.js` como referência para padronização de DAOs
