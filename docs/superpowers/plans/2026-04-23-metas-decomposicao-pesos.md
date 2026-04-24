# Metas decompostas, pesos e cumprimento ponderado — Plano de implementação

*(Elaborado com o skill writing-plans.)*

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar task a task. Passos com checkbox (`- [ ]`).

**Goal:** Implementar `parent_meta_id`, `papel`, `peso` em `tb_metas`; criação em pacote (agregada + componentes) com soma e validação; bloqueio de decomposição em indicador qualitativo; ajuste de `tb_acompanhamento_mensal` para múltiplas linhas por indicador/mês (uma por `meta` folha); cálculo de \(f_i\) com cap abaixo do mínimo e **F** global ponderado; UI de metas e entrada mensal alinhada ao spec.

**Architecture:** Migrações Sequelize para colunas de meta + alteração de unique de acompanhamento de `(indicador_id, mes_referencia)` para `(meta_id, mes_referencia)`. Lógica pura de cumprimento em `src/helper/metaCumprimentoPonderado.js`. `MetaService` centraliza criação transacional, validação de soma e versão única do pacote. `AcompanhamentosService` passa a indexar/criar acomp por `meta_id` e mes, listando **uma linha por folha**; agregados de volume e **F** calculados no serviço ou no payload da listagem.

**Tech stack:** Node.js, Express, Sequelize, MySQL, Joi, Mocha+Chai (`specs/`), React+TS (frontend em `frontend/`).

**Spec de referência:** `docs/superpowers/specs/2026-04-23-metas-decomposicao-pesos-design.md`

---

## File map (visão geral)

| Ação | Caminho |
|------|---------|
| Criar | `src/db/migrations/20260424XXXX01-add-meta-hierarchy-and-papel.js` (nome com timestamp real ao criar) |
| Criar | `src/db/migrations/20260424XXXX02-acompanhamento-unique-meta-mes.js` |
| Criar | `src/helper/metaCumprimentoPonderado.js` |
| Criar | `src/config/metaConstants.js` (ou constante em helper; um arquivo pequeno) |
| Criar | `specs/metas/cumprimento-ponderado.spec.js` |
| Modificar | `src/models/Meta.js` — campos, `associate` (parent/children) |
| Modificar | `src/service/MetaService.js` — toRecord, criar, criar pacote, listar, atualizar, versão |
| Modificar | `src/validator/MetaValidator.js` — `criarMeta` avulsa; novo schema `criarMetaPacote` (ou `modo` alternativo) |
| Modificar | `src/controllers/MetaController.js` — despachar POST por tipo de body |
| Modificar | `src/service/AcompanhamentosService.js` — `primeiraMetaVigente`, `listar`, `criar`, conflito unique, **F** e somas |
| Modificar | `src/service/AcompanhamentoService.js` (singular, se ainda usado) — rejeitar `meta` agregada |
| Modificar | `src/validator/AcompanhamentoValidator.js` (se houver) — `indicadorId` + `metaId` + mes |
| Modificar | `frontend/src/pages/Metas/types.ts`, `MetasList.tsx`, `MetasFormModal.tsx` |
| Modificar | `frontend/src/hooks/useApi.ts` ou chamadas de API de entrada mensal, conforme padrão atual |

---

## Task 1: Constante + funções puras (TDD)

**Nota:** A constante `src/config/metaConstants.js` e o helper são commitados juntos no final da Task 1 (um único commit após testes passarem).

---

## Task 1a: Constante de produto (cap abaixo do mínimo)

**Files:**
- Criar: `src/config/metaConstants.js`

- [ ] **Step 1: Criar arquivo**

```js
// src/config/metaConstants.js
/** Fator máximo f_i enquanto realizado < meta_minima (decisão produto, spec seção 5.1) */
const META_FATOR_CAP_SUBMIN = 0.5;

module.exports = { META_FATOR_CAP_SUBMIN };
```

---

## Task 1b: Funções puras de cumprimento (TDD)

**Files:**
- Criar: `src/helper/metaCumprimentoPonderado.js`
- Criar: `specs/metas/cumprimento-ponderado.spec.js`

- [ ] **Step 1: Escrever testes que definem o contrato**

Criar `specs/metas/cumprimento-ponderado.spec.js`:

```js
'use strict';
const { expect } = require('chai');
const {
  fatorLinhaMaiorIgual,
  cumprimentoGlobalPonderado,
} = require('../../src/helper/metaCumprimentoPonderado');

describe('metaCumprimentoPonderado', () => {
  it('fatorLinha: maior_igual, sem meta_minima → f = min(1, r)', () => {
    expect(fatorLinhaMaiorIgual({ valorRealizado: 50, metaVigenteMensal: 100, metaMinima: null, capSubmin: 0.5 }))
      .to.equal(0.5);
    expect(fatorLinhaMaiorIgual({ valorRealizado: 120, metaVigenteMensal: 100, metaMinima: null, capSubmin: 0.5 }))
      .to.equal(1);
  });

  it('fatorLinha: abaixo de meta_minima aplica cap', () => {
    expect(fatorLinhaMaiorIgual({ valorRealizado: 80, metaVigenteMensal: 100, metaMinima: 90, capSubmin: 0.5 }))
      .to.equal(0.5);
  });

  it('F global = média ponderada', () => {
    const F = cumprimentoGlobalPonderado([
      { peso: 1, f: 1 },
      { peso: 3, f: 0.5 },
    ]);
    expect(F).to.be.closeTo((1 * 1 + 3 * 0.5) / 4, 0.0001);
  });
});
```

- [ ] **Step 2: Rodar e ver falha**

```bash
npx mocha "./specs/metas/cumprimento-ponderado.spec.js" --exit
```

Esperado: erros (módulo ou função inexistente).

- [ ] **Step 3: Implementar** `src/helper/metaCumprimentoPonderado.js`

```js
const { META_FATOR_CAP_SUBMIN } = require('../config/metaConstants');

/**
 * @param {object} p
 * @param {number} p.valorRealizado
 * @param {number|null} p.metaVigenteMensal
 * @param {number|null} p.metaMinima
 * @param {number} [p.capSubmin] default META_FATOR_CAP_SUBMIN
 */
function fatorLinhaMaiorIgual(p) {
  const cap = p.capSubmin ?? META_FATOR_CAP_SUBMIN;
  const meta = p.metaVigenteMensal;
  if (meta == null || Number(meta) <= 0) return 0;
  const r = Number(p.valorRealizado) / Number(meta);
  const raw = Math.min(1, r);
  if (p.metaMinima == null) return raw;
  const m = parseFloat(p.metaMinima);
  if (Number(p.valorRealizado) < m) return Math.min(raw, cap);
  return raw;
}

/**
 * @param {Array<{ peso: number, f: number }>} linhas
 */
function cumprimentoGlobalPonderado(linhas) {
  if (!linhas.length) return null;
  let num = 0;
  let den = 0;
  for (const { peso, f } of linhas) {
    const w = parseFloat(peso);
    if (!(w > 0)) continue;
    num += w * f;
    den += w;
  }
  if (den === 0) return null;
  return num / den;
}

module.exports = { fatorLinhaMaiorIgual, cumprimentoGlobalPonderado };
```

- [ ] **Step 4: Rodar testes**

```bash
npx mocha "./specs/metas/cumprimento-ponderado.spec.js" --exit
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/helper/metaCumprimentoPonderado.js src/config/metaConstants.js specs/metas/cumprimento-ponderado.spec.js
git commit -m "feat(meta): add weighted completion helpers and tests"
```

---

## Task 2: Migração — colunas em `tb_metas`

**Files:**
- Criar: `src/db/migrations/20260424120001-add-hierarchy-to-tb-metas.js` (ajustar timestamp se colidir)

- [ ] **Step 1: Criar migration**

```js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_metas', 'parent_meta_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'tb_metas', key: 'meta_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addColumn('tb_metas', 'papel', {
      type: Sequelize.ENUM('agregada', 'componente', 'avulsa'),
      allowNull: false,
      defaultValue: 'avulsa',
    });
    await queryInterface.addColumn('tb_metas', 'peso', {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true,
    });
    await queryInterface.addIndex('tb_metas', ['parent_meta_id'], { name: 'idx_meta_parent' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tb_metas', 'idx_meta_parent');
    await queryInterface.removeColumn('tb_metas', 'peso');
    await queryInterface.removeColumn('tb_metas', 'papel');
    await queryInterface.removeColumn('tb_metas', 'parent_meta_id');
  },
};
```

- [ ] **Step 2: `npm run db:migrate`**

Esperado: migration aplicada sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/20260424120001-add-hierarchy-to-tb-metas.js
git commit -m "feat(db): add parent_meta_id, papel, peso to tb_metas"
```

---

## Task 3: Model Sequelize `Meta.js`

**Files:**
- Modificar: `src/models/Meta.js`

- [ ] **Step 1: Adicionar campos em `init`** (tipos alinhados à migration) e `associate`:

```js
// Dentro de init, após indicador_id ou campos existentes:
parent_meta_id: DataTypes.CHAR(36),
papel: {
  type: DataTypes.ENUM('agregada', 'componente', 'avulsa'),
  allowNull: false,
  defaultValue: 'avulsa',
},
peso: DataTypes.DECIMAL(10, 4),

// Em associate(models):
this.belongsTo(models.meta, { foreignKey: 'parent_meta_id', as: 'parent' });
this.hasMany(models.meta, { foreignKey: 'parent_meta_id', as: 'children' });
```

- [ ] **Step 2: Verificar carga dos models**

```bash
node -e "const m=require('./src/models'); console.log('meta' in m && 'associate' in m.meta);"
```

- [ ] **Step 3: Commit**

```bash
git add src/models/Meta.js
git commit -m "feat(model): meta hierarchy associations"
```

---

## Task 4: Migração — unique acomp por `meta` + mês

**Contexto:** Hoje `uk_acomp_ind_mes` em `(indicador_id, mes_referencia)` impede N lançamentos por mês para metas irmãs. O spec exige **uma linha de acomp por folha e mês**.

**Files:**
- Criar: `src/db/migrations/20260424120002-acompanhamento-unique-meta-mes.js`

- [ ] **Step 1: Criar migration**

```js
'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint('tb_acompanhamento_mensal', 'uk_acomp_ind_mes');
    await queryInterface.addConstraint('tb_acompanhamento_mensal', {
      fields: ['meta_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_acomp_meta_mes',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('tb_acompanhamento_mensal', 'uk_acomp_meta_mes');
    await queryInterface.addConstraint('tb_acompanhamento_mensal', {
      fields: ['indicador_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_acomp_ind_mes',
    });
  },
};
```

- [ ] **Step 2: Migrar em ambiente de dev; conferir se não há `meta_id` duplicado no mesmo mês (dados legados: uma meta por indicador, OK).**

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/20260424120002-acompanhamento-unique-meta-mes.js
git commit -m "fix(db): unique acompanhamento per meta_id and month"
```

---

## Task 5: `MetaService` — serialização e criação avulsa

**Files:**
- Modificar: `src/service/MetaService.js`
- Modificar: `src/validator/MetaValidator.js`

- [ ] **Step 1: Estender `toRecord`** com `parentMetaId`, `papel`, `peso`, `children` (quando `include` trouxer), espelhando camelCase do frontend existente.

- [ ] **Step 2: Em `criar`**, se payload não for pacote (ver Task 7), forçar `papel: 'avulsa'`, `parent_meta_id: null`, `peso: null` se omitidos. Recusar `papel` de agregada/componente via POST simples (só avulsa pelo endpoint legado).

- [ ] **Step 3: Validador Joi** — adicionar opcionais `papel`, `parentMetaId`, `peso` em `atualizarMeta` onde fizer sentido; manter criação simples com defaults.

- [ ] **Step 4: Teste manual** — POST `/api/metas` com body mínimo atual; esperar 201 e `papel: 'avulsa'`.

- [ ] **Step 5: Commit**

```bash
git add src/service/MetaService.js src/validator/MetaValidator.js
git commit -m "feat(metas): expose papel and defaults for avulsa"
```

---

## Task 6: `MetaService` — `POST` pacote (transação, versão única, soma, qualitativo)

**Files:**
- Modificar: `src/service/MetaService.js`
- Modificar: `src/validator/MetaValidator.js` — schema `criarMetaPacote`
- Modificar: `src/controllers/MetaController.js` — se `Array.isArray(req.body.componentes)` ou `req.body.modo === 'decomposto'`, chamar `criarPacote`

**Regras a codificar (espelhando o spec):**

1. Carregar `indicador` por `indicadorId`; se `indicador.tipo === 'qualitativo'`, 400.
2. `versao` = `max(versao) + 1` **uma vez** para o `indicador_id` (não N vezes).
3. Transação Sequelize: criar **agregada** (`papel: agregada`, `parent_meta_id: null`); depois N **componente** com mesmo `indicador_id`, `versao`, mesmas `vigencia_inicio`/`fim` do payload da agregada, `parent_meta_id` = id da agregada, `peso` do payload, `papel: componente`.
4. `sum(componentes.metaMensal) ≈ agregada.metaMensal` (tolerância 0,0001); idem anual.
5. Resposta: agregada com `include: { model: children }`.

**Estrutura de body sugerida:**

```json
{
  "modo": "decomposto",
  "indicadorId": "uuid",
  "agregada": {
    "vigenciaInicio": "2026-01-01",
    "vigenciaFim": null,
    "metaMensal": 1000,
    "metaAnual": 12000,
    "metaTipo": "maior_igual",
    "observacoes": "Pacote 2026"
  },
  "componentes": [
    { "metaMensal": 700, "metaAnual": 8400, "peso": 3, "observacoes": "Cirurgias" },
    { "metaMensal": 300, "metaAnual": 3600, "peso": 1, "observacoes": "Consultas" }
  ]
}
```

- [ ] **Step 1: Implementar `criarPacote` + validação Joi de `criarMetaPacote`.**

- [ ] **Step 2: Rota** — o mesmo `POST /api/metas` pode ramificar; alternativa: `POST /api/metas/pacote` (mais claro; exige 1 linha em `metaRoute.js` e método no controller).

- [ ] **Step 3: Commit**

```bash
git add src/service/MetaService.js src/validator/MetaValidator.js src/controllers/MetaController.js src/route/metaRoute.js
git commit -m "feat(metas): create decomposed package with one version and sum check"
```

---

## Task 7: `MetaService` — listar e buscar com árvore

- [ ] **Step 1: `listar`**: para cada meta raiz com filhos, anexar `children` (query extra ou `include` em `where: { parent_meta_id: null }` com `include: [{ as: 'children', ... }]`). Metas com `papel: componente` **não** duplicar no topo: filtrar `where: { parent_meta_id: null }` no list, **ou** retornar plano e filtrar filhas. **Decisão:** `findAll` com `include: [children]` onde `parent_meta_id: null` para não listar filhas soltas duas vezes.

- [ ] **Step 2: `buscarPorId`**: se id for agregada, `include: children`. Se for componente, incluir `parent`.

- [ ] **Step 3: Commit**

```bash
git add src/service/MetaService.js
git commit -m "feat(metas): list and get tree for decomposed metas"
```

---

## Task 8: `AcompanhamentosService` — metas folha e criação por `meta_id`

**Requisitos:**

1. Substituir `primeiraMetaVigente` usada para **escolher meta única** por lógica que distinga:
   - Se existe meta **agregada** com filhas, **não** usar a agregada para snapshot de lançamento; usar cada **componente** como alvo.
2. `listar`: para cada indicador, se há pacote decomposto, retornar **N** itens (um por **folha** com acomp) ou N slots sem acomp; **F** e soma de `valor_realizado` no objeto agregado **por indicador** (ex.: `cumprimentoGlobalPonderado`, `realizadoTotal`, `metaMensalTotal`).

3. `criar`: payload deve incluir **`metaId`** (obrigatório para indicador com múltiplas folhas ativas). Conflito em `(meta_id, mes_referencia)`.
   - Migração de API: se só uma meta avulsa vigente, ainda exige `metaId` explícito **ou** inferir a única folha. **Especificação do plano:** exigir `metaId` sempre no POST de criação (frontend envia) para evitar ambiguidade. Para compat, se omitido e só uma folha vigente, usar essa.

4. `toRecord` pode continuar 1-1; para lista expandida, helper `toRecordFolha(indicador, metaFolha, acomp)`.

- [ ] **Implementar** ajustes em `src/service/AcompanhamentosService.js` e `src/validator` da rota de acomp.

- [ ] **Exportar** `fatorLinhaMaiorIgual` e `cumprimentoGlobalPonderado` usados com dados das folhas e acomps do mês.

- [ ] **Commit**

```bash
git add src/service/AcompanhamentosService.js src/validator/*Acompanhamento* src/controllers/*Acomp*
git commit -m "feat(acompanhamentos): per-leaf row, weighted F, metaId in create"
```

---

## Task 9: `AcompanhamentoService` (singular) e rotas

- [ ] **Step 1:** Onde cria ou atualiza por `meta_id`, validar `meta.papel !== 'agregada'`.

- [ ] **Step 2: Commit** se arquivos existirem e forem usados em produção.

---

## Task 10: Testes de integração / regressão

- [ ] **Step 1:** Estender `specs/acompanhamentos/status-cumprimento.spec.js` se necessário, ou adicionar `specs/metas/pacote-api.spec.js` com supertest se o projeto já tiver padrão (ver `package.json`). Se não houver supertest, manter testes de serviço com mocks mínimos.

- [ ] **Step 2:** `npx mocha './specs/**/*.spec.js' --exit` — tudo verde.

---

## Task 11: Frontend — tipos e formulário

**Files:**
- `frontend/src/pages/Metas/types.ts` — `papel`, `peso`, `parentMetaId`, `children`
- `MetasList.tsx` — grupos colapsáveis; colunas peso; tooltip para **F** se API enviar
- `MetasFormModal.tsx` — fluxo "simples" vs "decomposição" (tabela de linhas com peso e % da meta mês)

- [ ] **Step 1:** Alinhar `useApi` / fetch ao novo `POST` pacote e listagem com árvore.

- [ ] **Step 2:** `npm run build` (ou `npx tsc --noEmit`) no frontend.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Metas
git commit -m "feat(frontend): metas decomposed form and list"
```

---

## Task 12: Atualizar spec (status) e doc ERD opcional

- [ ] **Step 1:** Em `2026-04-23-metas-decomposicao-pesos-design.md`, alterar `Status` para `Approved` e referenciar o plano `docs/superpowers/plans/2026-04-23-metas-decomposicao-pesos.md`.

- [ ] **Step 2: Commit** `docs/...`

---

## Spec coverage (self-review)

| Requisito do spec | Task |
|-------------------|------|
| Colunas + FK + índice | 2, 3 |
| Papel e peso | 2, 3, 5, 6 |
| Soma volume | 6 |
| Qualitativo sem decomposição | 6 |
| Realizado por folha (B) | 4, 8 |
| f_i com cap, F ponderado | 1, 8 |
| Versão única pacote | 6 |
| UI lista + entrada | 11 |
| Acomp agregada sem valor_realizado | 8, 9 |

**Placeholder scan:** nenhum TBD remanescente; timestamps de migration ajustar ao criar arquivos reais.

---

## Execution handoff

**Plano salvo em:** `docs/superpowers/plans/2026-04-23-metas-decomposicao-pesos.md`

**Duas opções de execução:**

1. **Subagent-Driven (recomendado)** — um subagente por task, revisão entre tasks (`superpowers:subagent-driven-development`).

2. **Inline** — executar na sessão com checkpoints (`superpowers:executing-plans`).

Qual abordagem você prefere para implementar?
