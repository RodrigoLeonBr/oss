---
name: documentation
description: Generate and update technical documentation. Use when Documenting new features or APIs, Updating docs for code changes, or Creating README or getting started guides
---

## Workflow

1. Identificar o público-alvo: desenvolvedor, gestor SMS, auditor, equipe OSS
2. Para documentação técnica: usar `docs/` (Markdown com Mermaid quando necessário)
3. Para documentação de API: atualizar `docs/ARQUITETURA_v2.md` seção de endpoints
4. Para schema do banco: atualizar `docs/banco_v2.md` com SQL real das migrations
5. Para diagramas: atualizar `docs/erd_v2.md` com diagramas Mermaid
6. Idioma: Português-BR para toda documentação de negócio

## Examples

**Documentação de endpoint (padrão ARQUITETURA_v2):**
```markdown
### POST /api/acompanhamento
- **Descrição**: Registrar acompanhamento mensal de indicador
- **Auth**: JWT + RBAC (admin, gestor_sms, contratada)
- **Body**:
  - `indicador_id` (UUID, obrigatório)
  - `mes_referencia` (YYYY-MM, obrigatório)
  - `valor_realizado` (decimal, obrigatório)
  - `evidencia_url` (string, opcional)
- **Response**: 201 Created com acompanhamento criado
- **Regras**: Calcula automaticamente `percentual_cumprimento` e `status_cumprimento`
```

**Documentação de tabela (padrão banco_v2):**
```sql
CREATE TABLE tb_rubricas (
  rubrica_id   CHAR(36) NOT NULL DEFAULT (UUID()),
  contrato_id  CHAR(36) NOT NULL,
  nome         VARCHAR(120) NOT NULL,
  valor_previsto DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (rubrica_id),
  FOREIGN KEY (contrato_id) REFERENCES tb_contratos(contrato_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Quality Bar

- Português-BR para documentação de negócio e API
- Dados reais do contexto de Americana/SP (nomes de unidades, valores de contratos)
- Diagramas Mermaid para relacionamentos e fluxos
- Referências cruzadas entre PRD, arquitetura, banco e ERD
- Versionamento: indicar "v2" nos nomes de arquivo quando for evolução

## Resource Strategy

- Manter documentação principal em `docs/` (4 arquivos v2)
- Documentação de contexto em `.context/docs/`
- Não duplicar informação entre docs e código; preferir referências
