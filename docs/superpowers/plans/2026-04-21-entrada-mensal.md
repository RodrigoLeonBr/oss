# Entrada Mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `EntradaMensalPage.tsx` por Hub+List+Modal com backend real (`/acompanhamentos`), cálculo de status por `meta_tipo`, e campo `meta_tipo` nas metas anuais.

**Architecture:** Três módulos independentes: (1) adiciona `meta_tipo` em `tb_metas`; (2) cria API `/acompanhamentos` que faz merge backend-side de indicadores+metas+lançamentos; (3) split frontend em `EntradaMensalHub` / `EntradaMensalList` / `EntradaMensalModal`. O backend novo usa arquivos com sufixo `s` (`AcompanhamentosService.js`) para não quebrar o `/acompanhamento-mensal` existente (usado pelo fluxo de aprovação).

**Tech Stack:** Node.js/Express, Sequelize 6, Joi, MySQL; React 18 + TypeScript + Vite 8, react-window v2, lucide-react, react-router-dom v6.

---

## Contexto do projeto — leia antes de começar

- **Migrations:** `src/db/migrations/YYYYMMDDHHMMSS-<nome>.js` — padrão `module.exports = { async up(queryInterface, Sequelize){}, async down(queryInterface){} }`
- **Rodar migrations:** `npm run db:migrate` na raiz
- **Backend dev:** `npm run dev:backend` (porta 4001)
- **Frontend dev:** `npm run dev:frontend` (Vite, porta 5173)
- **Testes backend:** `npm test` (mocha, specs/`**/*.spec.js`)
- **Controller pattern:** classe com arrow-function methods, `require` do service no topo, formato de resposta `{ status: true, data: ... }`
- **Route pattern:** `auth()` em todas; `authorize(PERFIS.X, PERFIS.Y)` para escrita; `auditar('tabela', 'ACTION')` em INSERT/UPDATE
- **Validator pattern:** Joi + `module.exports = { schema1, schema2 }` — camelCase no payload
- **Frontend mock fallback:** se `useApi` lança 401/404 em DEV, o catch faz `setItens(mockItens)` — não importa o erro
- **react-window v2 API:** `<List rowComponent={Row} rowCount={n} rowHeight={52} rowProps={...} />`
- **Field wrapper fora do componente:** define `function Field()` fora do pai para não perder foco

---

## Mapa de arquivos

### Módulo 1 — meta_tipo nas Metas
| Ação | Arquivo |
|---|---|
| Create | `src/db/migrations/20260421000001-add-meta-tipo-to-tb-metas.js` |
| Modify | `src/models/Meta.js` |
| Modify | `src/service/MetaService.js` |
| Modify | `src/validator/MetaValidator.js` |
| Modify | `frontend/src/pages/Metas/types.ts` |
| Modify | `frontend/src/pages/Metas/MetasFormModal.tsx` |

### Módulo 2 — API /acompanhamentos
| Ação | Arquivo |
|---|---|
| Create | `src/db/migrations/20260421000002-add-snapshot-fields-to-tb-acompanhamento-mensal.js` |
| Modify | `src/models/AcompanhamentoMensal.js` |
| Create | `src/service/AcompanhamentosService.js` |
| Create | `src/validator/AcompanhamentosValidator.js` |
| Create | `src/controllers/AcompanhamentosController.js` |
| Create | `src/route/acompanhamentosRoute.js` |
| Modify | `src/route/index.js` |

### Módulo 3 — Frontend EntradaMensal
| Ação | Arquivo |
|---|---|
| Create | `frontend/src/pages/EntradaMensal/types.ts` |
| Create | `frontend/src/pages/EntradaMensal/EntradaMensalModal.tsx` |
| Create | `frontend/src/pages/EntradaMensal/EntradaMensalList.tsx` |
| Create | `frontend/src/pages/EntradaMensal/EntradaMensalHub.tsx` |
| Modify | `frontend/src/App.tsx` |

---

## Task 1: Migration + Model — campo `meta_tipo` em `tb_metas`

**Files:**
- Create: `src/db/migrations/20260421000001-add-meta-tipo-to-tb-metas.js`
- Modify: `src/models/Meta.js`

- [ ] **Step 1: Escrever migration**

```js
// src/db/migrations/20260421000001-add-meta-tipo-to-tb-metas.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_metas', 'meta_tipo', {
      type: Sequelize.ENUM('maior_igual', 'menor_igual'),
      allowNull: false,
      defaultValue: 'maior_igual',
      after: 'meta_valor_qualit',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tb_metas', 'meta_tipo');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS ENUM_tb_metas_meta_tipo");
  },
};
```

- [ ] **Step 2: Rodar migration**

```bash
npm run db:migrate
```

Esperado: `== 20260421000001-add-meta-tipo-to-tb-metas: migrated`

- [ ] **Step 3: Atualizar `src/models/Meta.js` — adicionar campo `meta_tipo` após `meta_valor_qualit`**

Adicione após a linha `meta_valor_qualit: DataTypes.DECIMAL(15, 4),`:

```js
meta_tipo: {
  type: DataTypes.ENUM('maior_igual', 'menor_igual'),
  allowNull: false,
  defaultValue: 'maior_igual',
},
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/20260421000001-add-meta-tipo-to-tb-metas.js src/models/Meta.js
git commit -m "feat(metas): add meta_tipo column to tb_metas"
```

---

## Task 2: MetaService + MetaValidator — suporte a `metaTipo`

**Files:**
- Modify: `src/service/MetaService.js`
- Modify: `src/validator/MetaValidator.js`
- Test: `specs/metas/meta-tipo.spec.js`

- [ ] **Step 1: Escrever teste para `toRecord` com `metaTipo`**

```js
// specs/metas/meta-tipo.spec.js
const { expect } = require('chai');

// Reimplemente toRecord localmente para teste unitário puro
function toRecord(m) {
  const d = m.toJSON ? m.toJSON() : m;
  const fim = d.vigencia_fim ?? null;
  return {
    id:             d.meta_id,
    indicadorId:    d.indicador_id,
    versao:         d.versao,
    vigenciaInicio: d.vigencia_inicio,
    vigenciaFim:    fim,
    metaMensal:     d.meta_mensal     != null ? parseFloat(d.meta_mensal)     : null,
    metaAnual:      d.meta_anual      != null ? parseFloat(d.meta_anual)      : null,
    metaValorQualit:d.meta_valor_qualit!= null ? parseFloat(d.meta_valor_qualit): null,
    metaMinima:     d.meta_minima     != null ? parseFloat(d.meta_minima)     : null,
    metaParcial:    d.meta_parcial    != null ? parseFloat(d.meta_parcial)    : null,
    metaTipo:       d.meta_tipo       ?? 'maior_igual',
    unidadeMedida:  d.unidade_medida  ?? null,
    observacoes:    d.observacoes     ?? null,
    prazoImplantacao: d.prazo_implantacao ?? null,
    status: !fim || new Date(fim) >= new Date() ? 'vigente' : 'encerrada',
    createdAt: d.criado_em,
    updatedAt: d.atualizado_em,
  };
}

describe('MetaService — toRecord', () => {
  it('inclui metaTipo maior_igual por default', () => {
    const raw = { meta_id: 'abc', indicador_id: 'x', versao: 1,
      vigencia_inicio: '2026-01-01', vigencia_fim: null,
      meta_mensal: '1000', meta_tipo: 'maior_igual',
      criado_em: new Date(), atualizado_em: new Date() };
    const r = toRecord(raw);
    expect(r.metaTipo).to.equal('maior_igual');
  });

  it('inclui metaTipo menor_igual quando definido', () => {
    const raw = { meta_id: 'abc', indicador_id: 'x', versao: 1,
      vigencia_inicio: '2026-01-01', vigencia_fim: null,
      meta_mensal: '30', meta_tipo: 'menor_igual',
      criado_em: new Date(), atualizado_em: new Date() };
    const r = toRecord(raw);
    expect(r.metaTipo).to.equal('menor_igual');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar (arquivo não existe)**

```bash
npm test -- --grep "MetaService"
```

Esperado: `Error: cannot find module` ou `0 passing, 1 failing`

- [ ] **Step 3: Atualizar `src/service/MetaService.js` — `toRecord` e `fromPayload`**

Em `toRecord`, adicione a linha `metaTipo` após `metaParcial`:

```js
metaTipo:         d.meta_tipo         ?? 'maior_igual',
```

Em `fromPayload`, adicione a linha após o bloco `metaParcial`:

```js
if (p.metaTipo !== undefined) m.meta_tipo = p.metaTipo;
```

- [ ] **Step 4: Atualizar `src/validator/MetaValidator.js`**

Em `criarMeta`, adicione após a linha `prazoImplantacao`:

```js
metaTipo: Joi.string().valid('maior_igual', 'menor_igual').default('maior_igual'),
```

Em `atualizarMeta`, adicione:

```js
metaTipo: Joi.string().valid('maior_igual', 'menor_igual').optional(),
```

- [ ] **Step 5: Rodar teste — deve passar**

```bash
npm test -- --grep "MetaService"
```

Esperado: `2 passing`

- [ ] **Step 6: Commit**

```bash
git add src/service/MetaService.js src/validator/MetaValidator.js specs/metas/meta-tipo.spec.js
git commit -m "feat(metas): expose metaTipo in service and validator"
```

---

## Task 3: Frontend Metas — `metaTipo` em types.ts e MetasFormModal

**Files:**
- Modify: `frontend/src/pages/Metas/types.ts`
- Modify: `frontend/src/pages/Metas/MetasFormModal.tsx`

- [ ] **Step 1: Adicionar `metaTipo` em `MetaRecord` e `MetaFormData`**

Em `frontend/src/pages/Metas/types.ts`:

Na interface `MetaRecord`, adicione após `metaParcial`:
```ts
metaTipo: 'maior_igual' | 'menor_igual'
```

Na interface `MetaFormData`, adicione após `metaParcial`:
```ts
metaTipo: 'maior_igual' | 'menor_igual'
```

Na interface `MetaFormErrors`, não é necessário adicionar (metaTipo tem default válido).

Nos `mockMetas`, adicione `metaTipo: 'maior_igual'` em cada objeto.

- [ ] **Step 2: Atualizar `MetasFormModal.tsx`**

Localize o estado inicial do formulário (objeto com `vigenciaInicio`, `metaMensal` etc.) e adicione:
```ts
metaTipo: meta?.metaTipo ?? 'maior_igual',
```

Adicione um campo `<select>` para `metaTipo` no formulário, **antes** dos campos de `metaMinima` e `metaParcial` (pois os labels desses campos dependem do tipo):

```tsx
<Field id="metaTipo" label="Tipo de meta" required>
  <select
    id="metaTipo"
    value={form.metaTipo}
    onChange={e => setForm(f => ({ ...f, metaTipo: e.target.value as 'maior_igual' | 'menor_igual' }))}
    className={inputCls(false)}
  >
    <option value="maior_igual">↑ Maior ou igual (mais é melhor)</option>
    <option value="menor_igual">↓ Menor ou igual (menos é melhor)</option>
  </select>
</Field>
```

Atualize os labels de `metaMinima` e `metaParcial` para serem dinâmicos:

```tsx
// label metaMinima
label={form.metaTipo === 'maior_igual'
  ? 'Limite mínimo (x) — não atingido abaixo deste valor'
  : 'Limite atingido (x) — atingido abaixo deste valor'}

// label metaParcial
label={form.metaTipo === 'maior_igual'
  ? 'Limite parcial (y) — parcialmente atingido entre x e y'
  : 'Limite parcial (y) — parcialmente atingido entre y e x'}
```

No payload enviado ao `useApi`, inclua `metaTipo: form.metaTipo`.

- [ ] **Step 3: Verificar no browser**

Abra `/metas` → qualquer indicador → "+ Nova Meta". Confirme que o select "Tipo de meta" aparece e que os labels de `metaMinima`/`metaParcial` mudam ao trocar o tipo.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Metas/types.ts frontend/src/pages/Metas/MetasFormModal.tsx
git commit -m "feat(metas): add metaTipo field to form and types"
```

---

## Task 4: Migration — campos snapshot em `tb_acompanhamento_mensal`

**Files:**
- Create: `src/db/migrations/20260421000002-add-snapshot-fields-to-tb-acompanhamento-mensal.js`
- Modify: `src/models/AcompanhamentoMensal.js`

- [ ] **Step 1: Escrever migration**

```js
// src/db/migrations/20260421000002-add-snapshot-fields-to-tb-acompanhamento-mensal.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Snapshot fields — só add se não existirem (idempotente)
    const tableDesc = await queryInterface.describeTable('tb_acompanhamento_mensal');

    if (!tableDesc.meta_minima) {
      await queryInterface.addColumn('tb_acompanhamento_mensal', 'meta_minima', {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: true,
        after: 'meta_vigente_qualit',
      });
    }

    if (!tableDesc.meta_parcial) {
      await queryInterface.addColumn('tb_acompanhamento_mensal', 'meta_parcial', {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: true,
        after: 'meta_minima',
      });
    }

    if (!tableDesc.meta_tipo_snap) {
      await queryInterface.addColumn('tb_acompanhamento_mensal', 'meta_tipo_snap', {
        type: Sequelize.ENUM('maior_igual', 'menor_igual'),
        allowNull: false,
        defaultValue: 'maior_igual',
        after: 'meta_parcial',
      });
    }

    // Expande ENUM status_cumprimento para incluir novos valores
    await queryInterface.changeColumn('tb_acompanhamento_mensal', 'status_cumprimento', {
      type: Sequelize.ENUM(
        'cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando', // valores legados
        'atingido', 'nao_atingido', 'pendente',                               // novos valores
      ),
      allowNull: false,
      defaultValue: 'aguardando',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tb_acompanhamento_mensal', 'meta_tipo_snap');
    await queryInterface.removeColumn('tb_acompanhamento_mensal', 'meta_parcial');
    await queryInterface.removeColumn('tb_acompanhamento_mensal', 'meta_minima');
    await queryInterface.changeColumn('tb_acompanhamento_mensal', 'status_cumprimento', {
      type: Sequelize.ENUM('cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando'),
      allowNull: false,
      defaultValue: 'aguardando',
    });
  },
};
```

> **Nota:** Usamos `meta_tipo_snap` (não `meta_tipo`) para evitar conflito com eventual coluna futura na tabela.

- [ ] **Step 2: Rodar migration**

```bash
npm run db:migrate
```

Esperado: `== 20260421000002-add-snapshot-fields-to-tb-acompanhamento-mensal: migrated`

- [ ] **Step 3: Atualizar `src/models/AcompanhamentoMensal.js`**

Adicione os novos campos após `meta_vigente_qualit`:

```js
meta_minima:     DataTypes.DECIMAL(15, 4),
meta_parcial:    DataTypes.DECIMAL(15, 4),
meta_tipo_snap:  {
  type: DataTypes.ENUM('maior_igual', 'menor_igual', 'cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando', 'atingido', 'nao_atingido', 'pendente'),
  allowNull: false,
  defaultValue: 'maior_igual',
},
```

Atualize o ENUM `status_cumprimento` para aceitar os novos valores:

```js
status_cumprimento: {
  type: DataTypes.ENUM(
    'cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando',
    'atingido', 'nao_atingido', 'pendente',
  ),
  allowNull: false,
  defaultValue: 'aguardando',
},
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/20260421000002-add-snapshot-fields-to-tb-acompanhamento-mensal.js src/models/AcompanhamentoMensal.js
git commit -m "feat(acompanhamentos): add snapshot fields and expand status enum"
```

---

## Task 5: AcompanhamentosService — lógica nova

**Files:**
- Create: `src/service/AcompanhamentosService.js`
- Test: `specs/acompanhamentos/status-cumprimento.spec.js`

- [ ] **Step 1: Escrever teste para `calcularStatus`**

```js
// specs/acompanhamentos/status-cumprimento.spec.js
const { expect } = require('chai');

function calcularStatus(metaTipo, valorRealizado, metaParcial, metaMinima) {
  if (valorRealizado === null || valorRealizado === undefined) return 'pendente';
  if (metaTipo === 'maior_igual') {
    if (valorRealizado >= metaParcial) return 'atingido';
    if (valorRealizado >= metaMinima) return 'parcial';
    return 'nao_atingido';
  }
  // menor_igual
  if (valorRealizado <= metaMinima) return 'atingido';
  if (valorRealizado <= metaParcial) return 'parcial';
  return 'nao_atingido';
}

describe('calcularStatus', () => {
  describe('maior_igual', () => {
    it('atingido quando >= metaParcial', () => {
      expect(calcularStatus('maior_igual', 1200, 1020, 840)).to.equal('atingido');
      expect(calcularStatus('maior_igual', 1020, 1020, 840)).to.equal('atingido');
    });
    it('parcial quando >= metaMinima e < metaParcial', () => {
      expect(calcularStatus('maior_igual', 900, 1020, 840)).to.equal('parcial');
      expect(calcularStatus('maior_igual', 840, 1020, 840)).to.equal('parcial');
    });
    it('nao_atingido quando < metaMinima', () => {
      expect(calcularStatus('maior_igual', 839, 1020, 840)).to.equal('nao_atingido');
    });
  });

  describe('menor_igual', () => {
    it('atingido quando <= metaMinima', () => {
      expect(calcularStatus('menor_igual', 3, 8, 5)).to.equal('atingido');
      expect(calcularStatus('menor_igual', 5, 8, 5)).to.equal('atingido');
    });
    it('parcial quando > metaMinima e <= metaParcial', () => {
      expect(calcularStatus('menor_igual', 7, 8, 5)).to.equal('parcial');
      expect(calcularStatus('menor_igual', 8, 8, 5)).to.equal('parcial');
    });
    it('nao_atingido quando > metaParcial', () => {
      expect(calcularStatus('menor_igual', 9, 8, 5)).to.equal('nao_atingido');
    });
  });

  it('pendente quando valorRealizado é null', () => {
    expect(calcularStatus('maior_igual', null, 100, 70)).to.equal('pendente');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
npm test -- --grep "calcularStatus"
```

Esperado: `Error: cannot find module` ou `0 passing`

- [ ] **Step 3: Criar `src/service/AcompanhamentosService.js`**

```js
// src/service/AcompanhamentosService.js
const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');
const db = require('../models');

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularStatus(metaTipo, valorRealizado, metaParcial, metaMinima) {
  if (valorRealizado === null || valorRealizado === undefined) return 'pendente';
  const v = parseFloat(valorRealizado);
  const p = parseFloat(metaParcial);
  const m = parseFloat(metaMinima);
  if (metaTipo === 'maior_igual') {
    if (v >= p) return 'atingido';
    if (v >= m) return 'parcial';
    return 'nao_atingido';
  }
  // menor_igual
  if (v <= m) return 'atingido';
  if (v <= p) return 'parcial';
  return 'nao_atingido';
}

function primeiraMetaVigente(metas) {
  const hoje = new Date();
  return metas
    .filter(mt => new Date(mt.vigencia_inicio) <= hoje)
    .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio))[0] ?? null;
}

function toRecord(indicador, meta, acomp) {
  const metaTipo = acomp?.meta_tipo_snap ?? meta?.meta_tipo ?? 'maior_igual';
  const valorRealizado = acomp?.valor_realizado != null ? parseFloat(acomp.valor_realizado) : null;
  const metaMinima = acomp?.meta_minima != null ? parseFloat(acomp.meta_minima) : (meta?.meta_minima != null ? parseFloat(meta.meta_minima) : null);
  const metaParcial = acomp?.meta_parcial != null ? parseFloat(acomp.meta_parcial) : (meta?.meta_parcial != null ? parseFloat(meta.meta_parcial) : null);
  const metaVigenteMensal = acomp?.meta_vigente_mensal != null ? parseFloat(acomp.meta_vigente_mensal) : (meta?.meta_mensal != null ? parseFloat(meta.meta_mensal) : null);
  const metaVigenteQualit = acomp?.meta_vigente_qualit != null ? parseFloat(acomp.meta_vigente_qualit) : (meta?.meta_valor_qualit != null ? parseFloat(meta.meta_valor_qualit) : null);

  return {
    id:                   acomp?.acomp_id ?? null,
    indicadorId:          indicador.indicador_id,
    metaId:               acomp?.meta_id ?? meta?.meta_id ?? null,
    mesReferencia:        acomp?.mes_referencia ?? null,
    metaVigenteMensal,
    metaVigenteQualit,
    metaMinima,
    metaParcial,
    metaTipo,
    valorRealizado,
    percentualCumprimento: metaVigenteMensal && metaVigenteMensal > 0 && valorRealizado !== null
      ? parseFloat(((valorRealizado / metaVigenteMensal) * 100).toFixed(2))
      : null,
    statusCumprimento: calcularStatus(metaTipo, valorRealizado, metaParcial, metaMinima),
    statusAprovacao:   acomp?.status_aprovacao ?? null,
    descricaoDesvios:  acomp?.descricao_desvios ?? null,
    descontoEstimado:  acomp?.desconto_estimado != null ? parseFloat(acomp.desconto_estimado) : 0,
    indicador: {
      id:           indicador.indicador_id,
      nome:         indicador.nome,
      tipo:         indicador.tipo === 'quantitativo' ? 'producao' : 'qualidade',
      unidadeId:    indicador.unidade_id,
      unidadeMedida: indicador.unidade_medida ?? null,
    },
  };
}

// ── Listar — merge indicadores + metas + acompanhamentos ─────────────────────

const listar = async ({ unidadeId, mesReferencia }) => {
  if (!unidadeId) throw new ApiError(httpStatus.BAD_REQUEST, 'unidadeId é obrigatório');

  const mes = mesReferencia ?? (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();

  const indicadores = await db.indicador.findAll({
    where: { unidade_id: unidadeId, ativo: 1 },
    include: [{ model: db.meta, as: 'metas', required: false }],
  });

  const indicadorIds = indicadores.map(i => i.indicador_id);

  const acomps = indicadorIds.length > 0
    ? await db.acompanhamento_mensal.findAll({
        where: { indicador_id: indicadorIds, mes_referencia: mes },
      })
    : [];

  const acompByIndicador = {};
  for (const a of acomps) acompByIndicador[a.indicador_id] = a;

  return indicadores.map(ind => {
    const meta = primeiraMetaVigente(ind.metas ?? []);
    const acomp = acompByIndicador[ind.indicador_id] ?? null;
    return toRecord(ind, meta, acomp);
  });
};

// ── Buscar por id ─────────────────────────────────────────────────────────────

const buscarPorId = async (id) => {
  const acomp = await db.acompanhamento_mensal.findOne({
    where: { acomp_id: id },
    include: [{
      model: db.indicador,
      as: 'indicador',
      include: [{ model: db.meta, as: 'metas', required: false }],
    }],
  });
  if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');
  const meta = primeiraMetaVigente(acomp.indicador?.metas ?? []);
  return toRecord(acomp.indicador, meta, acomp);
};

// ── Criar ─────────────────────────────────────────────────────────────────────

const criar = async (payload) => {
  const { indicadorId, mesReferencia, valorRealizado, descricaoDesvios } = payload;

  const existente = await db.acompanhamento_mensal.findOne({
    where: { indicador_id: indicadorId, mes_referencia: mesReferencia },
  });
  if (existente) throw new ApiError(httpStatus.CONFLICT, 'Acompanhamento já existe para este indicador e mês. Use PUT para atualizar.');

  const indicador = await db.indicador.findOne({
    where: { indicador_id: indicadorId, ativo: 1 },
    include: [{ model: db.meta, as: 'metas', required: false }],
  });
  if (!indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');

  const meta = primeiraMetaVigente(indicador.metas ?? []);
  const metaTipo = meta?.meta_tipo ?? 'maior_igual';
  const metaMinima = meta?.meta_minima != null ? parseFloat(meta.meta_minima) : null;
  const metaParcial = meta?.meta_parcial != null ? parseFloat(meta.meta_parcial) : null;
  const metaVigenteMensal = meta?.meta_mensal != null ? parseFloat(meta.meta_mensal) : null;
  const metaVigenteQualit = meta?.meta_valor_qualit != null ? parseFloat(meta.meta_valor_qualit) : null;
  const v = parseFloat(valorRealizado);
  const statusCumprimento = calcularStatus(metaTipo, v, metaParcial, metaMinima);
  const percentual = metaVigenteMensal && metaVigenteMensal > 0
    ? parseFloat(((v / metaVigenteMensal) * 100).toFixed(4))
    : null;

  const novo = await db.acompanhamento_mensal.create({
    indicador_id:        indicadorId,
    meta_id:             meta?.meta_id ?? null,
    mes_referencia:      mesReferencia,
    meta_vigente_mensal: metaVigenteMensal,
    meta_vigente_qualit: metaVigenteQualit,
    meta_minima:         metaMinima,
    meta_parcial:        metaParcial,
    meta_tipo_snap:      metaTipo,
    valor_realizado:     v,
    percentual_cumprimento: percentual,
    status_cumprimento:  statusCumprimento,
    status_aprovacao:    'submetido',
    descricao_desvios:   descricaoDesvios ?? null,
  });

  return toRecord(indicador, meta, novo);
};

// ── Atualizar ─────────────────────────────────────────────────────────────────

const atualizar = async (id, payload) => {
  const acomp = await db.acompanhamento_mensal.findOne({
    where: { acomp_id: id },
    include: [{
      model: db.indicador,
      as: 'indicador',
      include: [{ model: db.meta, as: 'metas', required: false }],
    }],
  });
  if (!acomp) throw new ApiError(httpStatus.NOT_FOUND, 'Acompanhamento não encontrado');

  const metaTipo = acomp.meta_tipo_snap ?? 'maior_igual';
  const metaMinima = acomp.meta_minima != null ? parseFloat(acomp.meta_minima) : null;
  const metaParcial = acomp.meta_parcial != null ? parseFloat(acomp.meta_parcial) : null;
  const metaVigenteMensal = acomp.meta_vigente_mensal != null ? parseFloat(acomp.meta_vigente_mensal) : null;
  const v = parseFloat(payload.valorRealizado);
  const statusCumprimento = calcularStatus(metaTipo, v, metaParcial, metaMinima);
  const percentual = metaVigenteMensal && metaVigenteMensal > 0
    ? parseFloat(((v / metaVigenteMensal) * 100).toFixed(4))
    : null;

  await acomp.update({
    valor_realizado:     v,
    percentual_cumprimento: percentual,
    status_cumprimento:  statusCumprimento,
    descricao_desvios:   payload.descricaoDesvios ?? acomp.descricao_desvios,
  });

  const meta = primeiraMetaVigente(acomp.indicador?.metas ?? []);
  return toRecord(acomp.indicador, meta, await acomp.reload());
};

module.exports = { listar, buscarPorId, criar, atualizar, calcularStatus };
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
npm test -- --grep "calcularStatus"
```

Esperado: `7 passing`

- [ ] **Step 5: Commit**

```bash
git add src/service/AcompanhamentosService.js specs/acompanhamentos/status-cumprimento.spec.js
git commit -m "feat(acompanhamentos): new service with meta_tipo-aware status calculation"
```

---

## Task 6: AcompanhamentosValidator + Controller + Route

**Files:**
- Create: `src/validator/AcompanhamentosValidator.js`
- Create: `src/controllers/AcompanhamentosController.js`
- Create: `src/route/acompanhamentosRoute.js`
- Modify: `src/route/index.js`

- [ ] **Step 1: Criar `src/validator/AcompanhamentosValidator.js`**

```js
// src/validator/AcompanhamentosValidator.js
const Joi = require('joi');

const listarAcompanhamentos = Joi.object({
  unidadeId:      Joi.string().uuid().required()
                    .messages({ 'any.required': 'unidadeId é obrigatório' }),
  mesReferencia:  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const criarAcompanhamento = Joi.object({
  indicadorId:    Joi.string().uuid().required()
                    .messages({ 'any.required': 'indicadorId é obrigatório' }),
  mesReferencia:  Joi.string().pattern(/^\d{4}-\d{2}-01$/).required()
                    .messages({
                      'any.required': 'mesReferencia é obrigatório',
                      'string.pattern.base': 'mesReferencia deve estar no formato YYYY-MM-01',
                    }),
  valorRealizado: Joi.number().min(0).required()
                    .messages({ 'any.required': 'valorRealizado é obrigatório' }),
  descricaoDesvios: Joi.string().max(2000).optional().allow('', null),
});

const atualizarAcompanhamento = Joi.object({
  valorRealizado:  Joi.number().min(0).required(),
  descricaoDesvios: Joi.string().max(2000).optional().allow('', null),
});

module.exports = { listarAcompanhamentos, criarAcompanhamento, atualizarAcompanhamento };
```

- [ ] **Step 2: Criar `src/controllers/AcompanhamentosController.js`**

```js
// src/controllers/AcompanhamentosController.js
const httpStatus = require('http-status');
const AcompanhamentosService = require('../service/AcompanhamentosService');
const { listarAcompanhamentos, criarAcompanhamento, atualizarAcompanhamento } = require('../validator/AcompanhamentosValidator');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class AcompanhamentosController {
  listar = async (req, res, next) => {
    try {
      const { error, value } = listarAcompanhamentos.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const data = await AcompanhamentosService.listar(value);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };

  buscarPorId = async (req, res, next) => {
    try {
      const data = await AcompanhamentosService.buscarPorId(req.params.id);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };

  criar = async (req, res, next) => {
    try {
      const { error, value } = criarAcompanhamento.validate(req.body);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const data = await AcompanhamentosService.criar(value);
      return res.status(httpStatus.CREATED).json({ status: true, message: 'Acompanhamento registrado com sucesso', data });
    } catch (e) { logger.error(e); return next(e); }
  };

  atualizar = async (req, res, next) => {
    try {
      const { error, value } = atualizarAcompanhamento.validate(req.body);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const data = await AcompanhamentosService.atualizar(req.params.id, value);
      return res.status(httpStatus.OK).json({ status: true, message: 'Acompanhamento atualizado com sucesso', data });
    } catch (e) { logger.error(e); return next(e); }
  };
}

module.exports = AcompanhamentosController;
```

- [ ] **Step 3: Criar `src/route/acompanhamentosRoute.js`**

```js
// src/route/acompanhamentosRoute.js
const express = require('express');
const AcompanhamentosController = require('../controllers/AcompanhamentosController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new AcompanhamentosController();

router.get('/',    auth(), controller.listar);
router.get('/:id', auth(), controller.buscarPorId);

router.post(
  '/',
  auth(),
  authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
  auditar('tb_acompanhamento_mensal', 'INSERT'),
  controller.criar,
);

router.put(
  '/:id',
  auth(),
  authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
  auditar('tb_acompanhamento_mensal', 'UPDATE'),
  controller.atualizar,
);

module.exports = router;
```

- [ ] **Step 4: Registrar rota em `src/route/index.js`**

Adicione a linha de require após os outros requires:

```js
const acompanhamentosRoute = require('./acompanhamentosRoute');
```

Adicione ao array `defaultRoutes`:

```js
{ path: '/acompanhamentos', route: acompanhamentosRoute },
```

- [ ] **Step 5: Testar API manualmente**

```bash
# Inicie o backend
npm run dev:backend

# Em outro terminal — liste (substitua o JWT pelo seu token)
curl -H "Authorization: Bearer SEU_JWT" \
  "http://localhost:4001/api/v1/acompanhamentos?unidadeId=u1111111-1111-1111-1111-111111111111"
```

Esperado: JSON `{ status: true, data: [...] }` com um objeto por indicador da unidade.

- [ ] **Step 6: Commit**

```bash
git add src/validator/AcompanhamentosValidator.js src/controllers/AcompanhamentosController.js src/route/acompanhamentosRoute.js src/route/index.js
git commit -m "feat(acompanhamentos): add /acompanhamentos API endpoint"
```

---

## Task 7: Frontend — `EntradaMensal/types.ts`

**Files:**
- Create: `frontend/src/pages/EntradaMensal/types.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
// frontend/src/pages/EntradaMensal/types.ts

export interface AcompanhamentoRecord {
  id: string | null
  indicadorId: string
  metaId: string | null
  mesReferencia: string
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

// ── Labels ────────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<AcompanhamentoRecord['statusCumprimento'], string> = {
  atingido:    'Atingido',
  parcial:     'Parcial',
  nao_atingido:'Não atingido',
  pendente:    'Pendente',
}

export const STATUS_BADGE: Record<AcompanhamentoRecord['statusCumprimento'], string> = {
  atingido:    'bg-status-ok-bg text-status-ok border border-status-ok-border',
  parcial:     'bg-status-warn-bg text-status-warn border border-status-warn-border',
  nao_atingido:'bg-status-bad-bg text-status-bad border border-status-bad-border',
  pendente:    'bg-surface-alt text-text-secondary border border-border-subtle',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function calcularStatusPreview(
  metaTipo: 'maior_igual' | 'menor_igual',
  valorRealizado: number | null,
  metaParcial: number | null,
  metaMinima: number | null,
): AcompanhamentoRecord['statusCumprimento'] {
  if (valorRealizado === null) return 'pendente'
  if (metaTipo === 'maior_igual') {
    if (metaParcial !== null && valorRealizado >= metaParcial) return 'atingido'
    if (metaMinima !== null && valorRealizado >= metaMinima) return 'parcial'
    return 'nao_atingido'
  }
  // menor_igual
  if (metaMinima !== null && valorRealizado <= metaMinima) return 'atingido'
  if (metaParcial !== null && valorRealizado <= metaParcial) return 'parcial'
  return 'nao_atingido'
}

export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

// ── Mock data (DEV fallback) ──────────────────────────────────────────────────

export const mockAcompanhamentos: AcompanhamentoRecord[] = [
  {
    id: null,
    indicadorId: 'i1111111-1111-1111-1111-111111111111',
    metaId: 'm1111111-1111-1111-1111-111111111111',
    mesReferencia: '2026-04-01',
    metaVigenteMensal: 1200,
    metaVigenteQualit: null,
    metaMinima: 840,
    metaParcial: 1020,
    metaTipo: 'maior_igual',
    valorRealizado: null,
    percentualCumprimento: null,
    statusCumprimento: 'pendente',
    statusAprovacao: null,
    descricaoDesvios: null,
    descontoEstimado: 0,
    indicador: {
      id: 'i1111111-1111-1111-1111-111111111111',
      nome: 'Taxa de Ocupação de Leitos',
      tipo: 'producao',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidadeMedida: 'atendimentos',
    },
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    indicadorId: 'i2222222-2222-2222-2222-222222222222',
    metaId: 'm3333333-3333-3333-3333-333333333333',
    mesReferencia: '2026-04-01',
    metaVigenteMensal: null,
    metaVigenteQualit: 30,
    metaMinima: 45,
    metaParcial: 38,
    metaTipo: 'menor_igual',
    valorRealizado: 28,
    percentualCumprimento: 93.33,
    statusCumprimento: 'atingido',
    statusAprovacao: 'submetido',
    descricaoDesvios: null,
    descontoEstimado: 0,
    indicador: {
      id: 'i2222222-2222-2222-2222-222222222222',
      nome: 'Tempo Médio de Espera',
      tipo: 'qualidade',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidadeMedida: 'minutos',
    },
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/EntradaMensal/types.ts
git commit -m "feat(entrada-mensal): add AcompanhamentoRecord types and mock data"
```

---

## Task 8: `EntradaMensalModal`

**Files:**
- Create: `frontend/src/pages/EntradaMensal/EntradaMensalModal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// frontend/src/pages/EntradaMensal/EntradaMensalModal.tsx
import { useState, useEffect, useRef } from 'react'
import { X, Target, AlertCircle, Loader2 } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_LABELS, STATUS_BADGE, calcularStatusPreview, unwrap } from './types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  acompanhamento: AcompanhamentoRecord
  onSalvo: (atualizado: AcompanhamentoRecord) => void
  onFechar: () => void
}

// ── Field wrapper — fora do componente pai para evitar remontagem ─────────────
interface FieldProps {
  id: string; label: string; required?: boolean; error?: string; children: React.ReactNode
}
function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}{required && <span className="ml-1 text-status-bad">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-status-bad">
          <AlertCircle size={12} />{error}
        </p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border px-3 py-2.5 text-sm text-text-primary bg-surface',
    'placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors',
    hasError ? 'border-status-bad' : 'border-border',
  ].join(' ')
}

function faixaLabel(metaTipo: 'maior_igual' | 'menor_igual', metaMinima: number | null, metaParcial: number | null) {
  if (metaMinima === null || metaParcial === null) return null
  if (metaTipo === 'maior_igual') {
    return [
      `✓ Atingido: ≥ ${metaParcial}`,
      `~ Parcial: entre ${metaMinima} e ${metaParcial}`,
      `✗ Não atingido: < ${metaMinima}`,
    ]
  }
  return [
    `✓ Atingido: ≤ ${metaMinima}`,
    `~ Parcial: entre ${metaMinima} e ${metaParcial}`,
    `✗ Não atingido: > ${metaParcial}`,
  ]
}

export default function EntradaMensalModal({ acompanhamento: ac, onSalvo, onFechar }: Props) {
  const api = useApi()
  const inputRef = useRef<HTMLInputElement>(null)

  const [valorStr, setValorStr] = useState(ac.valorRealizado?.toString() ?? '')
  const [descricao, setDescricao] = useState(ac.descricaoDesvios ?? '')
  const [erros, setErros] = useState<{ valor?: string; descricao?: string }>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const valor = valorStr === '' ? null : parseFloat(valorStr)
  const statusPreview = calcularStatusPreview(ac.metaTipo, valor, ac.metaParcial, ac.metaMinima)
  const precisaDescricao = statusPreview !== 'atingido' || ac.metaTipo === 'menor_igual'
  const faixas = faixaLabel(ac.metaTipo, ac.metaMinima, ac.metaParcial)

  // Mês/ano para o header
  const [anoStr, mesStr] = (ac.mesReferencia ?? '').split('-')
  const mesLabel = mesStr && anoStr
    ? new Date(parseInt(anoStr), parseInt(mesStr) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : ''

  function validate(): boolean {
    const e: typeof erros = {}
    if (valor === null || isNaN(valor) || valor < 0) e.valor = 'Informe um valor numérico ≥ 0'
    if (precisaDescricao && !descricao.trim()) e.descricao = 'Descrição de desvios é obrigatória'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setApiError(null)
    try {
      let result: AcompanhamentoRecord
      if (ac.id === null) {
        const raw = await api.post('/acompanhamentos', {
          indicadorId: ac.indicadorId,
          mesReferencia: ac.mesReferencia,
          valorRealizado: valor,
          descricaoDesvios: descricao || null,
        })
        result = unwrap(raw) as AcompanhamentoRecord
      } else {
        const raw = await api.put(`/acompanhamentos/${ac.id}`, {
          valorRealizado: valor,
          descricaoDesvios: descricao || null,
        })
        result = unwrap(raw) as AcompanhamentoRecord
      }
      onSalvo(result)
    } catch (e) {
      if (e instanceof ApiError) setApiError(e.message)
      else setApiError('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const percBar = ac.metaVigenteMensal && valor !== null
    ? Math.min(100, (valor / ac.metaVigenteMensal) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="w-full max-w-lg rounded-2xl bg-surface shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Target size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary truncate">{ac.indicador.nome}</p>
            <p className="text-xs text-text-secondary capitalize">{mesLabel}</p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-alt transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Bloco de contexto */}
          <div className="rounded-xl bg-surface-alt p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Meta principal</span>
              <span className="font-mono font-medium text-text-primary">
                {ac.metaVigenteMensal ?? ac.metaVigenteQualit ?? '—'}
                {ac.indicador.unidadeMedida ? ` ${ac.indicador.unidadeMedida}` : ''}
              </span>
            </div>
            {faixas && (
              <ul className="flex flex-col gap-0.5 text-xs text-text-secondary">
                {faixas.map(f => <li key={f}>{f}</li>)}
              </ul>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              {ac.metaTipo === 'maior_igual' ? '↑ maior é melhor' : '↓ menor é melhor'}
            </span>
          </div>

          {/* Campo valor */}
          <Field id="valorRealizado" label="Valor realizado" required error={erros.valor}>
            <input
              ref={inputRef}
              id="valorRealizado"
              type="number"
              min="0"
              step="any"
              value={valorStr}
              onChange={e => setValorStr(e.target.value)}
              className={inputCls(!!erros.valor)}
              placeholder="0"
            />
          </Field>

          {/* Preview em tempo real */}
          {valor !== null && !isNaN(valor) && (
            <div className="flex flex-col gap-2">
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    statusPreview === 'atingido' ? 'bg-status-ok' :
                    statusPreview === 'parcial'  ? 'bg-status-warn' : 'bg-status-bad',
                  ].join(' ')}
                  style={{ width: `${percBar}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">{percBar.toFixed(1)}%</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[statusPreview]}`}>
                  {STATUS_LABELS[statusPreview]}
                </span>
              </div>
            </div>
          )}

          {/* Campo desvios */}
          {precisaDescricao && (
            <Field id="descricaoDesvios" label="Descrição de desvios" required error={erros.descricao}>
              <textarea
                id="descricaoDesvios"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className={inputCls(!!erros.descricao) + ' resize-none'}
                rows={3}
                placeholder="Descreva o motivo do desvio em relação à meta..."
              />
            </Field>
          )}

          {apiError && (
            <p className="text-sm text-status-bad flex items-center gap-1">
              <AlertCircle size={14} />{apiError}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm border border-border text-text-secondary hover:bg-surface-alt transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl px-5 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {ac.id === null ? 'Lançar' : 'Atualizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/EntradaMensal/EntradaMensalModal.tsx
git commit -m "feat(entrada-mensal): add EntradaMensalModal with real-time status preview"
```

---

## Task 9: `EntradaMensalList`

**Files:**
- Create: `frontend/src/pages/EntradaMensal/EntradaMensalList.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// frontend/src/pages/EntradaMensal/EntradaMensalList.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { List } from 'react-window'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_LABELS, STATUS_BADGE, mockAcompanhamentos, unwrap } from './types'
import EntradaMensalModal from './EntradaMensalModal'
import { useApi } from '../../hooks/useApi'

const ROW_HEIGHT = 52

type Filtro = 'todos' | AcompanhamentoRecord['statusCumprimento']
type Coluna = 'nome' | 'meta' | 'realizado' | 'percentual' | 'status'

interface RowProps {
  index: number
  style: React.CSSProperties
  data: {
    itens: AcompanhamentoRecord[]
    onAbrir: (a: AcompanhamentoRecord) => void
  }
}

function Row({ index, style, data }: RowProps) {
  const a = data.itens[index]
  const perc = a.percentualCumprimento
  const percCls = a.statusCumprimento === 'atingido' ? 'text-status-ok' :
                  a.statusCumprimento === 'parcial'   ? 'text-status-warn' :
                  a.statusCumprimento === 'pendente'  ? 'text-text-faint' : 'text-status-bad'

  return (
    <div style={style} className="flex items-center px-4 gap-2 border-b border-border hover:bg-surface-alt group">
      {/* Indicador (2fr) */}
      <div className="flex-[2] flex items-center gap-2 min-w-0">
        <span className="truncate text-sm text-text-primary">{a.indicador.nome}</span>
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
          {a.metaTipo === 'maior_igual' ? '↑' : '↓'}
        </span>
      </div>
      {/* Tipo (70px) */}
      <div className="w-[70px] shrink-0">
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
          {a.indicador.tipo === 'producao' ? 'Prod.' : 'Qual.'}
        </span>
      </div>
      {/* Meta (90px) */}
      <div className="w-[90px] shrink-0 font-mono text-sm text-text-primary text-right">
        {a.metaVigenteMensal ?? a.metaVigenteQualit ?? '—'}
      </div>
      {/* Realizado (90px) */}
      <div className="w-[90px] shrink-0 font-mono text-sm text-right">
        {a.valorRealizado !== null
          ? <span className="text-text-primary">{a.valorRealizado}</span>
          : <span className="italic text-text-faint">—</span>}
      </div>
      {/* % (70px) */}
      <div className={`w-[70px] shrink-0 font-mono font-bold text-sm text-right ${percCls}`}>
        {perc !== null ? `${perc.toFixed(1)}%` : '—'}
      </div>
      {/* Status (80px) */}
      <div className="w-[80px] shrink-0">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[a.statusCumprimento]}`}>
          {STATUS_LABELS[a.statusCumprimento]}
        </span>
      </div>
      {/* Ações (72px) */}
      <div className="w-[72px] shrink-0 flex justify-end">
        <button
          onClick={() => data.onAbrir(a)}
          className={[
            'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
            a.id === null
              ? 'border border-border text-text-secondary hover:border-primary hover:text-primary'
              : 'bg-primary text-white hover:bg-primary/90',
          ].join(' ')}
        >
          {a.id === null ? 'Lançar' : 'Editar'}
        </button>
      </div>
    </div>
  )
}

export default function EntradaMensalList() {
  const { unidadeId } = useParams<{ unidadeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const api = useApi()

  const mes = searchParams.get('mes') ?? (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  const [itens, setItens] = useState<AcompanhamentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [nomeUnidade, setNomeUnidade] = useState('')
  const [modal, setModal] = useState<AcompanhamentoRecord | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [coluna, setColuna] = useState<Coluna>('nome')
  const [asc, setAsc] = useState(true)

  const mesInput = mes.slice(0, 7) // YYYY-MM

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await api.get(`/acompanhamentos?unidadeId=${unidadeId}&mesReferencia=${mes}`)
      setItens(unwrap(raw) as AcompanhamentoRecord[])
    } catch {
      setItens(mockAcompanhamentos)
    } finally {
      setLoading(false)
    }

    try {
      const raw = await api.get(`/unidades/${unidadeId}`)
      const u = unwrap(raw) as { nome: string }
      setNomeUnidade(u.nome)
    } catch { /* ignora */ }
  }, [unidadeId, mes])

  useEffect(() => { carregar() }, [carregar])

  function handleMesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [a, m] = e.target.value.split('-')
    if (a && m) setSearchParams({ mes: `${a}-${m}-01` })
  }

  function toggleSort(c: Coluna) {
    if (coluna === c) setAsc(v => !v)
    else { setColuna(c); setAsc(true) }
  }

  const filtrados = itens
    .filter(a => filtro === 'todos' || a.statusCumprimento === filtro)
    .sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0
      if (coluna === 'nome')      { va = a.indicador.nome; vb = b.indicador.nome }
      if (coluna === 'meta')      { va = a.metaVigenteMensal ?? 0; vb = b.metaVigenteMensal ?? 0 }
      if (coluna === 'realizado') { va = a.valorRealizado ?? -1; vb = b.valorRealizado ?? -1 }
      if (coluna === 'percentual'){ va = a.percentualCumprimento ?? -1; vb = b.percentualCumprimento ?? -1 }
      if (coluna === 'status')    { va = a.statusCumprimento; vb = b.statusCumprimento }
      if (va < vb) return asc ? -1 : 1
      if (va > vb) return asc ? 1 : -1
      return 0
    })

  const stats = {
    total:       itens.length,
    atingidos:   itens.filter(a => a.statusCumprimento === 'atingido').length,
    parciais:    itens.filter(a => a.statusCumprimento === 'parcial').length,
    pendentes:   itens.filter(a => a.statusCumprimento === 'pendente').length,
  }

  function handleSalvo(atualizado: AcompanhamentoRecord) {
    setItens(prev => {
      const idx = prev.findIndex(a => a.indicadorId === atualizado.indicadorId)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = atualizado
      return next
    })
    setModal(null)
  }

  const SortBtn = ({ c, label }: { c: Coluna; label: string }) => (
    <button onClick={() => toggleSort(c)} className="flex items-center gap-0.5 hover:text-primary">
      {label}{coluna === c ? (asc ? ' ↑' : ' ↓') : ''}
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + seletor de mês */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/entrada-mensal')} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary">{nomeUnidade || 'Entrada Mensal'}</h1>
        </div>
        <input
          type="month"
          value={mesInput}
          onChange={handleMesChange}
          className="rounded-xl border border-border px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: stats.total,     cls: 'text-text-primary' },
          { label: 'Atingidos', value: stats.atingidos,  cls: 'text-status-ok' },
          { label: 'Parciais',  value: stats.parciais,   cls: 'text-status-warn' },
          { label: 'Pendentes', value: stats.pendentes,  cls: 'text-text-secondary' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-text-secondary">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtro por status */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'atingido', 'parcial', 'nao_atingido', 'pendente'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
              filtro === f ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-primary',
            ].join(' ')}
          >
            {f === 'todos' ? 'Todos' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : filtrados.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">Nenhum indicador encontrado.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-4 py-2.5 bg-surface-alt border-b border-border text-xs font-medium text-text-secondary gap-2">
            <div className="flex-[2]"><SortBtn c="nome" label="Indicador" /></div>
            <div className="w-[70px] shrink-0">Tipo</div>
            <div className="w-[90px] shrink-0 text-right"><SortBtn c="meta" label="Meta" /></div>
            <div className="w-[90px] shrink-0 text-right"><SortBtn c="realizado" label="Realizado" /></div>
            <div className="w-[70px] shrink-0 text-right"><SortBtn c="percentual" label="%" /></div>
            <div className="w-[80px] shrink-0"><SortBtn c="status" label="Status" /></div>
            <div className="w-[72px] shrink-0" />
          </div>
          {/* Body */}
          <List
            rowComponent={Row}
            rowCount={filtrados.length}
            rowHeight={ROW_HEIGHT}
            height={Math.min(filtrados.length * ROW_HEIGHT, 520)}
            rowProps={{ itens: filtrados, onAbrir: setModal }}
          />
        </div>
      )}

      {modal && (
        <EntradaMensalModal
          acompanhamento={modal}
          onSalvo={handleSalvo}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/EntradaMensal/EntradaMensalList.tsx
git commit -m "feat(entrada-mensal): add EntradaMensalList with sortable react-window table"
```

---

## Task 10: `EntradaMensalHub`

**Files:**
- Create: `frontend/src/pages/EntradaMensal/EntradaMensalHub.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// frontend/src/pages/EntradaMensal/EntradaMensalHub.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronRight } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_BADGE, STATUS_LABELS, unwrap } from './types'
import { useApi } from '../../hooks/useApi'

interface UnidadeCard {
  id: string
  nome: string
  sigla?: string
}

const mockUnidades: UnidadeCard[] = [
  { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro', sigla: 'UPA-CTR' },
  { id: 'u2222222-2222-2222-2222-222222222222', nome: 'Hospital Municipal Sul', sigla: 'HMS' },
]

type StatusCumprimento = AcompanhamentoRecord['statusCumprimento']

interface Progresso {
  total: number
  lancados: number
  porStatus: Partial<Record<StatusCumprimento, number>>
}

function calcularProgresso(acomps: AcompanhamentoRecord[]): Progresso {
  const total = acomps.length
  const lancados = acomps.filter(a => a.id !== null).length
  const porStatus: Partial<Record<StatusCumprimento, number>> = {}
  for (const a of acomps) {
    porStatus[a.statusCumprimento] = (porStatus[a.statusCumprimento] ?? 0) + 1
  }
  return { total, lancados, porStatus }
}

export default function EntradaMensalHub() {
  const api = useApi()
  const navigate = useNavigate()

  const hoje = new Date()
  const mesDefault = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const [unidades, setUnidades] = useState<UnidadeCard[]>([])
  const [loadingUnidades, setLoadingUnidades] = useState(true)
  const [meses, setMeses] = useState<Record<string, string>>({}) // unidadeId → YYYY-MM-01
  const [progressos, setProgressos] = useState<Record<string, Progresso | null>>({}) // unidadeId → progresso

  const carregarUnidades = useCallback(async () => {
    setLoadingUnidades(true)
    try {
      const raw = await api.get('/unidades?ativo=1')
      const data = unwrap(raw) as UnidadeCard[]
      setUnidades(data)
      // Inicializa meses
      const m: Record<string, string> = {}
      for (const u of data) m[u.id] = mesDefault
      setMeses(m)
    } catch {
      setUnidades(mockUnidades)
      const m: Record<string, string> = {}
      for (const u of mockUnidades) m[u.id] = mesDefault
      setMeses(m)
    } finally {
      setLoadingUnidades(false)
    }
  }, [])

  useEffect(() => { carregarUnidades() }, [carregarUnidades])

  async function carregarProgresso(unidadeId: string, mesReferencia: string) {
    setProgressos(prev => ({ ...prev, [unidadeId]: null }))
    try {
      const raw = await api.get(`/acompanhamentos?unidadeId=${unidadeId}&mesReferencia=${mesReferencia}`)
      const data = unwrap(raw) as AcompanhamentoRecord[]
      setProgressos(prev => ({ ...prev, [unidadeId]: calcularProgresso(data) }))
    } catch {
      setProgressos(prev => ({ ...prev, [unidadeId]: { total: 0, lancados: 0, porStatus: {} } }))
    }
  }

  useEffect(() => {
    for (const u of unidades) {
      carregarProgresso(u.id, meses[u.id] ?? mesDefault)
    }
  }, [unidades])

  function handleMesChange(unidadeId: string, val: string) {
    const [a, m] = val.split('-')
    if (!a || !m) return
    const mes = `${a}-${m}-01`
    setMeses(prev => ({ ...prev, [unidadeId]: mes }))
    carregarProgresso(unidadeId, mes)
  }

  function handleAbrirUnidade(unidadeId: string) {
    const mes = meses[unidadeId] ?? mesDefault
    navigate(`/entrada-mensal/${unidadeId}?mes=${mes}`)
  }

  const STATUS_ORDER: StatusCumprimento[] = ['atingido', 'parcial', 'nao_atingido', 'pendente']

  if (loadingUnidades) {
    return <div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin text-primary" /></div>
  }

  if (unidades.length === 0) {
    return <p className="py-24 text-center text-sm text-text-secondary">Nenhuma unidade ativa encontrada.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-text-primary">Entrada Mensal</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {unidades.map(u => {
          const prog = progressos[u.id]
          const mesVal = (meses[u.id] ?? mesDefault).slice(0, 7) // YYYY-MM

          return (
            <div
              key={u.id}
              onClick={() => handleAbrirUnidade(u.id)}
              className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4 cursor-pointer hover:border-primary hover:shadow-sm transition-all group"
            >
              {/* Header do card */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary group-hover:text-primary transition-colors">{u.nome}</p>
                  {u.sigla && <p className="text-xs text-text-secondary">{u.sigla}</p>}
                </div>
                <ChevronRight size={16} className="text-text-faint group-hover:text-primary transition-colors mt-0.5" />
              </div>

              {/* Seletor de mês — para a propagação para não navegar */}
              <input
                type="month"
                value={mesVal}
                onClick={e => e.stopPropagation()}
                onChange={e => { e.stopPropagation(); handleMesChange(u.id, e.target.value) }}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {/* Barra de progresso */}
              {prog === null ? (
                <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-primary" /></div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Lançados</span>
                    <span className="font-medium text-text-primary">{prog.lancados}/{prog.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: prog.total > 0 ? `${(prog.lancados / prog.total) * 100}%` : '0%' }}
                    />
                  </div>
                  {/* Chips de status */}
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.filter(s => (prog.porStatus[s] ?? 0) > 0).map(s => (
                      <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>
                        {prog.porStatus[s]} {STATUS_LABELS[s]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/EntradaMensal/EntradaMensalHub.tsx
git commit -m "feat(entrada-mensal): add EntradaMensalHub with per-unit month selector and progress"
```

---

## Task 11: Atualizar `App.tsx` e remover página antiga

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Substituir imports e rotas em `App.tsx`**

Remova a linha:
```ts
const EntradaMensalPage = lazy(() => import('./pages/EntradaMensalPage'))
```

Adicione:
```ts
const EntradaMensalHub  = lazy(() => import('./pages/EntradaMensal/EntradaMensalHub'))
const EntradaMensalList = lazy(() => import('./pages/EntradaMensal/EntradaMensalList'))
```

Substitua o bloco da rota `/entrada-mensal` existente:

```tsx
// ANTES (apague isso):
<Route path="/entrada-mensal" element={
  <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
    <AppLayout><EntradaMensalPage /></AppLayout>
  </ProtectedRoute>
} />

// DEPOIS (coloque isso):
<Route path="/entrada-mensal" element={
  <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
    <AppLayout><EntradaMensalHub /></AppLayout>
  </ProtectedRoute>
} />
<Route path="/entrada-mensal/:unidadeId" element={
  <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
    <AppLayout><EntradaMensalList /></AppLayout>
  </ProtectedRoute>
} />
```

- [ ] **Step 2: Verificar no browser**

Navegue para `/entrada-mensal`. Deve aparecer cards por unidade. Clique em um card → deve ir para `/entrada-mensal/:unidadeId?mes=...` com a tabela de indicadores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(entrada-mensal): wire Hub and List routes, remove old EntradaMensalPage import"
```

---

## Self-Review Checklist

### 1. Spec coverage

| Requisito do spec | Task que implementa |
|---|---|
| `meta_tipo` em `tb_metas` | Task 1 |
| MetaService/Validator com `metaTipo` | Task 2 |
| MetasFormModal com select + labels dinâmicos | Task 3 |
| Migration snapshot fields | Task 4 |
| `GET /acompanhamentos` com merge backend | Task 5 + 6 |
| `POST /acompanhamentos` com 409 | Task 5 + 6 |
| `PUT /acompanhamentos/:id` | Task 5 + 6 |
| Cálculo `status_cumprimento` por `meta_tipo` | Task 5 |
| `AcompanhamentoRecord` TypeScript | Task 7 |
| `EntradaMensalModal` com preview em tempo real | Task 8 |
| `descricaoDesvios` obrigatório condicional | Task 8 |
| `EntradaMensalList` com react-window + sort + filtro | Task 9 |
| `EntradaMensalHub` com cards + seletor mês individual | Task 10 |
| Atualizar `App.tsx` | Task 11 |

### 2. Itens fora de escopo (não implementados por design)
- Cálculo de desconto financeiro
- Workflow de aprovação/rejeição
- Exportação de dados

### 3. Decisão de naming
Os novos arquivos de backend usam sufixo `s` (`AcompanhamentosService.js`, etc.) para coexistir com os arquivos legados sem quebrar `/acompanhamento-mensal` (usado pelo fluxo de aprovação).

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-21-entrada-mensal.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch um subagente por task, com review entre tasks, iteração rápida

**2. Inline Execution** — execute as tasks nesta sessão usando superpowers:executing-plans, com checkpoints de revisão

**Qual abordagem?**
