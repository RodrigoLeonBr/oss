# Entrada Mensal — Design Spec

**Data:** 2026-04-21  
**Status:** Aprovado

---

## Contexto

A página `/entrada-mensal` existente é desconectada do backend real: usa mocks hardcoded, mês fixo, sem persistência. Este spec cobre a reescrita completa com integração real, guiada pelos dados de Indicadores por Unidade e Metas Anuais.

---

## Decisões de design

| Decisão | Escolha |
|---|---|
| Quem lança | Gestor SMS / Admin |
| Escopo | Por unidade, uma por vez |
| Seleção de mês | Livre (qualquer mês retroativo), embutido por card de unidade |
| Submit flow | Auto-submit: cada save → `submetido` imediatamente |
| Layout hub | Cards por unidade com seletor de mês individual |
| Layout lista | Tabela compacta react-window v2 |

---

## Módulo 1 — Metas Anuais: campo `meta_tipo`

### Motivação

Indicadores `menor_igual` (ex: Taxa de Infecção — meta ≤ 5%) têm lógica de cumprimento invertida. O cálculo atual `(realizado/meta)*100` produz resultados errados para esses casos. A marcação deve ficar na **meta** (não no indicador) pois pode mudar entre versões.

### Migration SQL

```sql
ALTER TABLE tb_metas
  ADD COLUMN meta_tipo ENUM('maior_igual', 'menor_igual')
  NOT NULL DEFAULT 'maior_igual'
  AFTER meta_valor_qualit;
```

### Arquivos afetados

- `src/migrations/YYYYMMDD-add-meta-tipo.js` — migration Sequelize
- `src/service/MetaService.js` — incluir `meta_tipo` em `toRecord()` e `fromPayload()`
- `src/validator/MetaValidator.js` — adicionar `metaTipo` em `criarMeta` e `atualizarMeta`
- `frontend/src/pages/Metas/types.ts` — adicionar `metaTipo` em `MetaRecord` e `MetaFormData`
- `frontend/src/pages/Metas/MetasFormModal.tsx` — novo campo select + labels renomeados

### Labels no formulário

| Campo DB | Label novo |
|---|---|
| `meta_tipo` | "Tipo de meta" — "↑ Maior ou igual (mais é melhor)" / "↓ Menor ou igual (menos é melhor)" |
| `meta_minima` | `maior_igual`: "Limite mínimo (x) — não atingido abaixo deste valor" / `menor_igual`: "Limite atingido (x) — atingido abaixo deste valor" |
| `meta_parcial` | `maior_igual`: "Limite parcial (y) — parcialmente atingido entre x e y" / `menor_igual`: "Limite parcial (y) — parcialmente atingido entre y e x" |
| `meta_mensal` / `meta_valor_qualit` | "Meta principal (valor de referência 100%)" |

---

## Módulo 2 — Backend: /acompanhamentos

### Tabela `tb_acompanhamentos`

**Atenção:** A tabela existe no schema legado com campos `acomp_id`, `meta_vigente_mensal` etc. (snake_case antigo). A migration deve verificar se a estrutura é compatível; se necessário, criar a tabela nova com os campos abaixo usando o padrão camelCase do projeto.

Campos relevantes para este fluxo:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | |
| `indicador_id` | UUID FK | |
| `meta_id` | UUID FK | Meta vigente no momento do lançamento |
| `mes_referencia` | DATE | Sempre dia 01 do mês |
| `meta_vigente_mensal` | DECIMAL | Snapshot da meta no momento |
| `meta_vigente_qualit` | DECIMAL | Snapshot da meta qualitativa |
| `meta_minima` | DECIMAL | Snapshot do limite mínimo |
| `meta_parcial` | DECIMAL | Snapshot do limite parcial |
| `meta_tipo` | ENUM | Snapshot do tipo da meta |
| `valor_realizado` | DECIMAL | Valor lançado pelo gestor |
| `percentual_cumprimento` | DECIMAL | Calculado pelo backend |
| `status_cumprimento` | ENUM | `atingido` / `parcial` / `nao_atingido` / `pendente` |
| `status_aprovacao` | ENUM | `submetido` / `aprovado` / `rejeitado` |
| `descricao_desvios` | TEXT | Obrigatório quando não atingido |

### Regra de cálculo de status

**`maior_igual`:**
- `valor_realizado >= meta_parcial` → `atingido`
- `valor_realizado >= meta_minima` → `parcial`
- `valor_realizado < meta_minima` → `nao_atingido`

**`menor_igual`:**
- `valor_realizado <= meta_minima` → `atingido`
- `valor_realizado <= meta_parcial` → `parcial`
- `valor_realizado > meta_parcial` → `nao_atingido`

O `percentual_cumprimento` exibido na UI é sempre calculado como `(valor_realizado / meta_principal) * 100`, apenas para referência visual — o `status_cumprimento` usa as faixas acima.

### Rotas

```
GET  /acompanhamentos        auth()                                    listar
GET  /acompanhamentos/:id    auth()                                    buscarPorId
POST /acompanhamentos        auth() + authorize(ADMIN,GESTOR_SMS) + auditar  criar
PUT  /acompanhamentos/:id    auth() + authorize(ADMIN,GESTOR_SMS) + auditar  atualizar
```

### GET /acompanhamentos — query params

| Param | Obrigatoriedade | Descrição |
|---|---|---|
| `unidadeId` | obrigatório | UUID da unidade |
| `mesReferencia` | opcional | YYYY-MM-DD; default: primeiro dia do mês atual |

**Lógica de resposta:** Retorna um item por indicador ativo da unidade. Se não existe `tb_acompanhamentos` para aquele indicador+mês, retorna o indicador com campos de valor `null` e `status_cumprimento: 'pendente'`. O merge acontece no backend, eliminando complexidade no frontend.

### POST /acompanhamentos — payload

```json
{
  "indicadorId": "uuid",
  "mesReferencia": "2026-03-01",
  "valorRealizado": 8200,
  "descricaoDesvios": null
}
```

409 se já existe acompanhamento para `indicadorId + mesReferencia`.

### PUT /acompanhamentos/:id — payload

```json
{
  "valorRealizado": 8500,
  "descricaoDesvios": "Ajuste por auditoria"
}
```

### Arquivos novos

- `src/service/AcompanhamentoService.js`
- `src/validator/AcompanhamentoValidator.js`
- `src/controllers/AcompanhamentoController.js`
- `src/route/acompanhamentoRoute.js`
- Registrar rota em `src/route/index.js`

---

## Módulo 3 — Frontend: Entrada Mensal

### Tipo `AcompanhamentoRecord`

```typescript
// frontend/src/pages/EntradaMensal/types.ts
export interface AcompanhamentoRecord {
  id: string | null                    // null se não lançado ainda
  indicadorId: string
  metaId: string | null
  mesReferencia: string                // YYYY-MM-DD
  metaVigenteMensal: number | null
  metaVigenteQualit: number | null
  metaMinima: number | null
  metaParcial: number | null
  metaTipo: 'maior_igual' | 'menor_igual'
  valorRealizado: number | null
  percentualCumprimento: number | null
  statusCumprimento: 'atingido' | 'parcial' | 'nao_atingido' | 'pendente'
  statusAprovacao: 'submetido' | 'aprovado' | 'rejeitado' | null
  descricaoDesvios: string | null
  descontoEstimado: number
  indicador: {
    id: string
    nome: string
    tipo: 'producao' | 'qualidade'
    unidadeId: string
    unidadeMedida: string | null
  }
}
```

### `EntradaMensalHub` (`/entrada-mensal`)

- Busca `GET /unidades` (lista ativas)
- Para cada unidade, busca `GET /acompanhamentos?unidadeId=X&mesReferencia=Y` para calcular progresso
- Card por unidade:
  - Nome + sigla da unidade
  - Seletor de mês (`<input type="month">`) — default mês atual, estado local por card
  - Barra de progresso (`lançados / total`)
  - Chips: atingido (verde) / parcial (amarelo) / não atingido (vermelho) / pendente (cinza)
- Clique no card → `/entrada-mensal/:unidadeId?mes=YYYY-MM-01`
- Skeleton loading; empty state se sem unidades
- DEV mock fallback com `mockUnidades`

### `EntradaMensalList` (`/entrada-mensal/:unidadeId`)

- `useParams<{ unidadeId }>()`, `useSearchParams()` para `mes`
- Seletor de mês no header (muda query param, recarrega dados)
- Busca `GET /acompanhamentos?unidadeId=X&mesReferencia=Y`
- Busca `GET /unidades/:unidadeId` para breadcrumb
- Botão voltar → `/entrada-mensal`
- Stats cards (header strip pattern): Total | Atingidos | Parciais | Pendentes
- Tabela react-window v2, `ROW_HEIGHT = 52`, colunas:

| Coluna | Largura | Conteúdo |
|---|---|---|
| Indicador | 2fr | Nome truncado + badge `meta_tipo` (↑/↓) |
| Tipo | 70px | badge producao/qualidade |
| Meta | 90px | valor principal mono |
| Realizado | 90px | valor mono ou "—" itálico se pendente |
| % | 70px | mono bold colorido |
| Status | 80px | badge atingido/parcial/não atingido/pendente |
| Ações | 72px | "Lançar" outline / "Editar" filled |

- Sort por: nome, meta, realizado, %, status
- Filtro por status
- DEV mock: merge `mockIndicadores + mockMetas + mockAcompanhamentos`

### `EntradaMensalModal`

- Props: `acompanhamento: AcompanhamentoRecord`, `indicadorNome`, `onSalvo`, `onFechar`
- Header: ícone Target, nome indicador, mês/ano
- Bloco de contexto (`bg-surface-alt`):
  - Meta principal (mensal ou qualit) + unidade de medida
  - Faixas: "Atingido acima de {metaParcial}" / "Parcial entre {metaMinima} e {metaParcial}" / "Não atingido abaixo de {metaMinima}"
  - Badge `meta_tipo`: "↑ maior é melhor" ou "↓ menor é melhor"
- Input `valorRealizado` (number, min 0, step any)
- Preview em tempo real: barra de progresso colorida + badge de status
- Campo `descricaoDesvios`:
  - Sempre visível para `menor_igual`
  - Para `maior_igual`: aparece quando `statusCumprimento !== 'atingido'`
  - Obrigatório (valida no submit) quando `statusCumprimento !== 'atingido'`
- Submit: `POST /acompanhamentos` se `acompanhamento.id === null`, `PUT /acompanhamentos/:id` caso contrário
- Toast de sucesso na lista após fechar

### Arquivos novos

```
frontend/src/pages/EntradaMensal/
  types.ts
  EntradaMensalHub.tsx
  EntradaMensalList.tsx
  EntradaMensalModal.tsx
```

### Atualização `App.tsx`

```tsx
// Substituir rota atual /entrada-mensal/*
<Route path="/entrada-mensal" → EntradaMensalHub />
<Route path="/entrada-mensal/:unidadeId" → EntradaMensalList />
```

---

## Fora de escopo

- Cálculo de desconto financeiro (calculado pela camada de repasse, não aqui)
- Workflow de aprovação/rejeição (pertence a `/aprovacao`)
- Exportação de dados
- Histórico de alterações por lançamento

---

## Ordem de implementação sugerida

1. Migration `meta_tipo` + atualização Metas (MetaService, MetaValidator, MetaRecord, MetasFormModal)
2. Backend: AcompanhamentoService + Controller + Validator + Route
3. Frontend types (`AcompanhamentoRecord`, mocks, helpers)
4. `EntradaMensalList` + `EntradaMensalModal` (fluxo principal)
5. `EntradaMensalHub` (hub de seleção)
6. Atualizar `App.tsx` + remover página antiga
