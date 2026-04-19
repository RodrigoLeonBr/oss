---
type: skill
name: Test Generation
description: Generate comprehensive test cases for code. Use when Writing tests for new functionality, Adding tests for bug fixes (regression tests), or Improving test coverage for existing code
skillSlug: test-generation
phases: [E, V]
generated: 2026-04-13
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Identificar a função/endpoint a testar
2. Listar comportamentos: happy path, edge cases, erros
3. Mockar dependências externas (Sequelize models, Redis, Email)
4. Escrever testes com dados reais do PRD quando possível
5. Verificar cobertura: `npm test -- --coverage`
6. Confirmar que testes são determinísticos e isolados

## Examples

**Teste de cálculo de desconto (service):**
```javascript
const { calcularFaixaProducao, calcularStatusCumprimento } = require('../src/service/AcompanhamentoService');

describe('AcompanhamentoService', () => {
  describe('calcularFaixaProducao', () => {
    it('deve retornar abaixo_70 quando percentual < 70', () => {
      expect(calcularFaixaProducao(65.5)).toBe('abaixo_70');
    });

    it('deve retornar entre_70_99 quando percentual entre 70 e 99', () => {
      expect(calcularFaixaProducao(85.0)).toBe('entre_70_99');
    });

    it('deve retornar acima_100 quando percentual >= 100', () => {
      expect(calcularFaixaProducao(100.0)).toBe('acima_100');
    });
  });

  describe('calcularStatusCumprimento', () => {
    it('deve retornar cumprido quando valor >= meta', () => {
      expect(calcularStatusCumprimento(12500, 12000)).toBe('cumprido');
    });

    it('deve retornar nao_cumprido quando valor < 70% da meta', () => {
      expect(calcularStatusCumprimento(8000, 12000)).toBe('nao_cumprido');
    });
  });
});
```

**Teste de RBAC (integration):**
```javascript
const request = require('supertest');
const app = require('../src/app');

describe('RBAC - Acompanhamento routes', () => {
  it('deve retornar 403 para perfil cms tentando criar acompanhamento', async () => {
    const token = await getTokenForPerfil('cms');
    const res = await request(app)
      .post('/api/acompanhamento')
      .set('Authorization', `Bearer ${token}`)
      .send({ indicador_id: 'uuid', mes_referencia: '2026-01', valor_realizado: 100 });
    expect(res.status).toBe(403);
  });
});
```

## Quality Bar

- Arrange-Act-Assert em todos os testes
- Nomes descritivos: "deve retornar X quando Y"
- Dados reais do PRD: meta HMA Urgência 12.000/mês, valor contrato R$10M
- Testar os 5 perfis RBAC: admin, gestor_sms, auditora, cms, contratada
- Testar ambos modelos de desconto: flat (blocos) e ponderado (indicadores qualidade)
- Mocks apenas nas fronteiras (DB, Redis, Email), nunca no código sendo testado
- Testes isolados: não dependem de ordem de execução

## Resource Strategy

- Arquivos de teste em `specs/` ou `__tests__/` espelhando a estrutura de `src/`
- Fixtures com dados dos seeders para consistency
- Não criar helpers de teste excessivos; preferir setup inline simples
