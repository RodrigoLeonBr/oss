# Ponte de Produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comparar, por unidade e competência, o valor que a OSS informou na prestação (`tb_acompanhamento_mensal.valor_realizado`) contra a produção registrada nos bancos SIA/SIH do consultaprod, a partir de um mapa indicador→filtro (grupo/subgrupo/forma/procedimento) cadastrável.

**Architecture:** Feature inteira no OSS (Node/Express/Sequelize). Conexão Sequelize secundária **read-only** ao banco `producao` (mesmo MySQL, só SELECT raw). Nova tabela `tb_mapa_producao` (de-para). Dois recursos REST: `/mapa-producao` (CRUD) e `/ponte-producao` (comparação read-only), ambos sob `checkPermission('relatorios', …)` + escopo por OSS. Frontend: duas páginas lazy (cadastro do mapa + tela de comparação).

**Tech Stack:** Node 22, Express 4, Sequelize 6, MySQL 8, Joi, mocha+chai+sinon; React 19 + TS + Vite + Tailwind.

Spec: `docs/superpowers/specs/2026-10-18-ponte-producao-design.md`.

---

## File Structure

**Backend (banco `oss`):**
- Create `src/config/producaoDb.js` — conexão Sequelize read-only ao banco `producao`.
- Modify `src/config/config.js` — novas envs `DB_PRODUCAO_*`.
- Create `src/helper/filtroProducao.js` — valida/monta cláusula SQL por tipo de filtro (+ self-check).
- Create `src/models/MapaProducao.js` — model `tb_mapa_producao`.
- Create `src/db/migrations/20261018120000-create-tb-mapa-producao.js`.
- Create `src/validator/MapaProducaoValidator.js`.
- Create `src/service/MapaProducaoService.js`.
- Create `src/controllers/MapaProducaoController.js`.
- Create `src/route/mapaProducaoRoute.js`.
- Create `src/service/PonteProducaoService.js` — orquestra DB + função pura de comparação.
- Create `src/controllers/PonteProducaoController.js`.
- Create `src/route/ponteProducaoRoute.js`.
- Modify `src/route/index.js` — monta as duas rotas.
- Create `specs/ponte/filtroProducao.spec.js` e `specs/ponte/comparacao.spec.js`.

**Frontend:**
- Create `frontend/src/pages/Producao/types.ts`.
- Create `frontend/src/pages/Producao/MapaProducaoPage.tsx` (lista + modal inline).
- Create `frontend/src/pages/Producao/PonteProducaoPage.tsx` (comparação).
- Modify `frontend/src/App.tsx` — rotas lazy.
- Modify `frontend/src/components/SidebarMenu.tsx` — itens de navegação.

---

## Task 1: Envs do banco `producao` no config

**Files:**
- Modify: `src/config/config.js`
- Modify: `.env` (local, não versionado) e `env.docker.example`

- [ ] **Step 1: Adicionar as chaves no schema Joi**

Em `src/config/config.js`, dentro de `envValidation.keys({...})`, após a linha `REDIS_PASSWORD: Joi.string().allow(''),` adicionar:

```javascript
        DB_PRODUCAO_HOST: Joi.string().default('localhost'),
        DB_PRODUCAO_PORT: Joi.number().default(3306),
        DB_PRODUCAO_USER: Joi.string().default('hospital'),
        DB_PRODUCAO_PASS: Joi.string().allow('').default(''),
        DB_PRODUCAO_NAME: Joi.string().default('producao'),
```

- [ ] **Step 2: Exportar no objeto de config**

No `module.exports`, após o bloco `redis: {...},` adicionar:

```javascript
    producaoDb: {
        host: envVar.DB_PRODUCAO_HOST,
        port: envVar.DB_PRODUCAO_PORT,
        user: envVar.DB_PRODUCAO_USER,
        pass: envVar.DB_PRODUCAO_PASS,
        name: envVar.DB_PRODUCAO_NAME,
    },
```

- [ ] **Step 3: Documentar no `.env` local e no exemplo Docker**

Adicionar ao `.env` (e `env.docker.example`):

```
DB_PRODUCAO_HOST=localhost
DB_PRODUCAO_PORT=3306
DB_PRODUCAO_USER=hospital
DB_PRODUCAO_PASS=tebaldi
DB_PRODUCAO_NAME=producao
```

- [ ] **Step 4: Verificar que a API ainda sobe**

Run: `node -e "require('./src/config/config.js'); console.log('config OK')"`
Expected: imprime `config OK` sem lançar.

- [ ] **Step 5: Commit**

```bash
git add src/config/config.js env.docker.example
git commit -m "feat(ponte): envs de conexao ao banco producao"
```

---

## Task 2: Conexão Sequelize read-only ao `producao`

**Files:**
- Create: `src/config/producaoDb.js`

- [ ] **Step 1: Criar a conexão**

```javascript
const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('./logger');

// Conexão secundária SOMENTE LEITURA ao banco do consultaprod (SIA/SIH).
// Nunca criar/alterar dados aqui — só SELECT via sequelize.query.
const producaoDb = new Sequelize(
    config.producaoDb.name,
    config.producaoDb.user,
    config.producaoDb.pass,
    {
        host: config.producaoDb.host,
        port: config.producaoDb.port,
        dialect: 'mysql',
        logging: false,
        pool: { max: 3, min: 0, idle: 10000 },
        dialectOptions: { bigNumberStrings: true },
    },
);

async function pingProducao() {
    try {
        await producaoDb.authenticate();
        return true;
    } catch (e) {
        logger.error(`Banco producao indisponivel: ${e.message}`);
        return false;
    }
}

module.exports = { producaoDb, pingProducao };
```

- [ ] **Step 2: Verificar conexão real**

Run: `node -e "require('./src/config/producaoDb').pingProducao().then(ok => { console.log('producao:', ok); process.exit(0); })"`
Expected: imprime `producao: true` (XAMPP MySQL ligado, banco `producao` existente).

- [ ] **Step 3: Commit**

```bash
git add src/config/producaoDb.js
git commit -m "feat(ponte): conexao read-only ao banco producao"
```

---

## Task 3: Helper de filtro (validação + cláusula SQL) com self-check

**Files:**
- Create: `src/helper/filtroProducao.js`
- Test: self-check embutido (rodável com `node`)

- [ ] **Step 1: Escrever o helper com asserts no final**

```javascript
// Traduz um filtro do mapa (fonte + tipo_filtro + valor) para a cláusula SQL
// usada na agregação de produção. Fonte única desta regra — não duplicar em services.

const COMPRIMENTO = { grupo: 2, subgrupo: 4, forma: 6, procedimento: 10 };
const COLUNA = { sia: 'prd_pa', sih: 'PROC_DETALHADO' };

/** Valida valor por tipo: só dígitos e comprimento exato. Lança Error se inválido. */
function validarValorFiltro(tipoFiltro, valor) {
  const len = COMPRIMENTO[tipoFiltro];
  if (!len) throw new Error(`tipo_filtro inválido: ${tipoFiltro}`);
  if (typeof valor !== 'string' || !/^\d+$/.test(valor) || valor.length !== len) {
    throw new Error(`valor_filtro para "${tipoFiltro}" deve ter ${len} dígitos numéricos`);
  }
  return true;
}

/**
 * Monta a cláusula de código de procedimento para a agregação.
 * @returns {{ coluna:string, operador:'='|'LIKE', valor:string }}
 *   procedimento → igualdade; grupo/subgrupo/forma → prefixo LIKE 'valor%'.
 */
function clausulaFiltro(fonte, tipoFiltro, valor) {
  const coluna = COLUNA[fonte];
  if (!coluna) throw new Error(`fonte inválida: ${fonte}`);
  validarValorFiltro(tipoFiltro, valor);
  if (tipoFiltro === 'procedimento') return { coluna, operador: '=', valor };
  return { coluna, operador: 'LIKE', valor: `${valor}%` };
}

module.exports = { validarValorFiltro, clausulaFiltro, COMPRIMENTO, COLUNA };

// ── Self-check (node src/helper/filtroProducao.js) ───────────────────────────
if (require.main === module) {
  const assert = require('assert');

  // grupo → LIKE prefixo
  assert.deepStrictEqual(
    clausulaFiltro('sia', 'grupo', '03'),
    { coluna: 'prd_pa', operador: 'LIKE', valor: '03%' },
  );
  // forma (6) no SIH → coluna PROC_DETALHADO
  assert.deepStrictEqual(
    clausulaFiltro('sih', 'forma', '030101'),
    { coluna: 'PROC_DETALHADO', operador: 'LIKE', valor: '030101%' },
  );
  // procedimento (10) → igualdade
  assert.deepStrictEqual(
    clausulaFiltro('sia', 'procedimento', '0301010010'),
    { coluna: 'prd_pa', operador: '=', valor: '0301010010' },
  );
  // comprimento errado rejeitado
  assert.throws(() => validarValorFiltro('grupo', '0301'), /2 dígitos/);
  assert.throws(() => validarValorFiltro('procedimento', '03AB010010'), /10 dígitos/);
  // fonte/tipo inválidos
  assert.throws(() => clausulaFiltro('xpto', 'grupo', '03'), /fonte inválida/);

  console.log('OK');
}
```

- [ ] **Step 2: Rodar o self-check e ver falhar antes do arquivo existir — pular (arquivo já traz impl). Rodar e ver passar**

Run: `node src/helper/filtroProducao.js`
Expected: imprime `OK`.

- [ ] **Step 3: Espelhar o self-check como spec mocha (reuso da mesma lógica)**

Create `specs/ponte/filtroProducao.spec.js`:

```javascript
const { expect } = require('chai');
const { clausulaFiltro, validarValorFiltro } = require('../../src/helper/filtroProducao');

describe('filtroProducao', () => {
  it('grupo vira LIKE prefixo', () => {
    expect(clausulaFiltro('sia', 'grupo', '03'))
      .to.deep.equal({ coluna: 'prd_pa', operador: 'LIKE', valor: '03%' });
  });
  it('procedimento vira igualdade', () => {
    expect(clausulaFiltro('sia', 'procedimento', '0301010010'))
      .to.deep.equal({ coluna: 'prd_pa', operador: '=', valor: '0301010010' });
  });
  it('SIH usa coluna PROC_DETALHADO', () => {
    expect(clausulaFiltro('sih', 'subgrupo', '0301').coluna).to.equal('PROC_DETALHADO');
  });
  it('rejeita comprimento errado', () => {
    expect(() => validarValorFiltro('grupo', '0301')).to.throw(/2 dígitos/);
  });
});
```

Run: `npx mocha specs/ponte/filtroProducao.spec.js --exit`
Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add src/helper/filtroProducao.js specs/ponte/filtroProducao.spec.js
git commit -m "feat(ponte): helper de filtro SIGTAP com self-check"
```

---

## Task 4: Model + migração `tb_mapa_producao`

**Files:**
- Create: `src/models/MapaProducao.js`
- Create: `src/db/migrations/20261018120000-create-tb-mapa-producao.js`

- [ ] **Step 1: Criar o model**

```javascript
const { Model, DataTypes } = require('sequelize');

class MapaProducao extends Model {
  static init(sequelize) {
    return super.init(
      {
        mapa_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        fonte: { type: DataTypes.ENUM('sia', 'sih'), allowNull: false, defaultValue: 'sia' },
        tipo_filtro: { type: DataTypes.ENUM('grupo', 'subgrupo', 'forma', 'procedimento'), allowNull: false },
        valor_filtro: { type: DataTypes.STRING(10), allowNull: false },
        ativo: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'mapa_producao',
        tableName: 'tb_mapa_producao',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
    );
  }

  static associate(models) {
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
  }
}

module.exports = MapaProducao;
```

- [ ] **Step 2: Criar a migração**

```javascript
'use strict';

/**
 * De-para indicador → filtro de produção (grupo/subgrupo/forma/procedimento),
 * usado pela Ponte de Produção para somar SIA/SIH e comparar com o informado.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_mapa_producao', {
      mapa_id: { type: Sequelize.CHAR(36), primaryKey: true, defaultValue: Sequelize.literal('(UUID())') },
      indicador_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_indicadores', key: 'indicador_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fonte: { type: Sequelize.ENUM('sia', 'sih'), allowNull: false, defaultValue: 'sia' },
      tipo_filtro: { type: Sequelize.ENUM('grupo', 'subgrupo', 'forma', 'procedimento'), allowNull: false },
      valor_filtro: { type: Sequelize.STRING(10), allowNull: false },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('tb_mapa_producao', ['indicador_id'], { name: 'idx_mapa_indicador' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_mapa_producao');
  },
};
```

- [ ] **Step 3: Rodar a migração**

Run: `npm run db:migrate`
Expected: aplica `20261018120000-create-tb-mapa-producao` sem erro.

- [ ] **Step 4: Verificar o registro do model**

Run: `node -e "const db=require('./src/models'); console.log(!!db.mapa_producao, typeof db.mapa_producao.associate)"`
Expected: `true function`.

- [ ] **Step 5: Commit**

```bash
git add src/models/MapaProducao.js src/db/migrations/20261018120000-create-tb-mapa-producao.js
git commit -m "feat(ponte): model e migracao tb_mapa_producao"
```

---

## Task 5: Validator do mapa (Joi)

**Files:**
- Create: `src/validator/MapaProducaoValidator.js`

- [ ] **Step 1: Criar schemas**

```javascript
const Joi = require('joi');

const ID = () => Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);

const COMPRIMENTO = { grupo: 2, subgrupo: 4, forma: 6, procedimento: 10 };

// valor_filtro: dígitos, comprimento conforme tipo_filtro
const valorPorTipo = Joi.string().pattern(/^\d+$/).required().custom((value, helpers) => {
  const tipo = helpers.state.ancestors[0].tipo_filtro;
  const len = COMPRIMENTO[tipo];
  if (len && value.length !== len) {
    return helpers.error('any.invalid', { message: `valor_filtro deve ter ${len} dígitos para ${tipo}` });
  }
  return value;
}).messages({ 'any.invalid': 'valor_filtro com comprimento incompatível com tipo_filtro' });

const criarMapa = Joi.object({
  indicadorId: ID().required().messages({ 'any.required': 'indicadorId é obrigatório' }),
  fonte: Joi.string().valid('sia', 'sih').required(),
  tipoFiltro: Joi.string().valid('grupo', 'subgrupo', 'forma', 'procedimento').required(),
  valorFiltro: valorPorTipo,
  // alias snake p/ o custom achar tipo_filtro no mesmo nível
}).rename('tipoFiltro', 'tipo_filtro', { ignoreUndefined: false });

const atualizarMapa = Joi.object({
  fonte: Joi.string().valid('sia', 'sih').optional(),
  tipoFiltro: Joi.string().valid('grupo', 'subgrupo', 'forma', 'procedimento').optional(),
  valorFiltro: Joi.string().pattern(/^\d+$/).optional(),
  ativo: Joi.boolean().optional(),
}).min(1);

const listarMapa = Joi.object({
  indicadorId: ID().optional(),
  unidadeId: ID().optional(),
});

module.exports = { criarMapa, atualizarMapa, listarMapa };
```

> Nota: o `.rename` acima complica o `custom`. Simplificar — ver Step 2.

- [ ] **Step 2: Simplificar a validação de comprimento (sem rename)**

Substituir o bloco `criarMapa` por versão que valida comprimento num `.custom` no objeto inteiro:

```javascript
const criarMapa = Joi.object({
  indicadorId: ID().required().messages({ 'any.required': 'indicadorId é obrigatório' }),
  fonte: Joi.string().valid('sia', 'sih').required(),
  tipoFiltro: Joi.string().valid('grupo', 'subgrupo', 'forma', 'procedimento').required(),
  valorFiltro: Joi.string().pattern(/^\d+$/).required()
    .messages({ 'string.pattern.base': 'valorFiltro deve conter apenas dígitos' }),
}).custom((obj, helpers) => {
  const len = COMPRIMENTO[obj.tipoFiltro];
  if (len && obj.valorFiltro.length !== len) {
    return helpers.error('any.invalid');
  }
  return obj;
}).messages({ 'any.invalid': 'valorFiltro com comprimento incompatível com tipoFiltro' });
```

- [ ] **Step 3: Verificar validação**

Run:
```bash
node -e "const {criarMapa}=require('./src/validator/MapaProducaoValidator'); console.log(criarMapa.validate({indicadorId:'i1111111-1111-1111-1111-111111111111',fonte:'sia',tipoFiltro:'grupo',valorFiltro:'0301'}).error ? 'rejeitado' : 'aceito')"
```
Expected: `rejeitado` (grupo exige 2 dígitos).

- [ ] **Step 4: Commit**

```bash
git add src/validator/MapaProducaoValidator.js
git commit -m "feat(ponte): validator do mapa de producao"
```

---

## Task 6: Service CRUD do mapa (com escopo por OSS)

**Files:**
- Create: `src/service/MapaProducaoService.js`

- [ ] **Step 1: Criar o service**

```javascript
const httpStatus = require('http-status');
const db = require('../models');
const ApiError = require('../helper/ApiError');
const { assertIndicadorNoEscopoOSS, assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');

const includeEscopo = (ossIdFiltro) => [{
  model: db.indicador,
  as: 'indicador',
  required: true,
  include: [{
    model: db.unidade,
    as: 'unidade',
    required: true,
    include: [{
      model: db.contrato,
      as: 'contrato',
      required: true,
      where: ossIdFiltro ? { oss_id: ossIdFiltro } : undefined,
    }],
  }],
}];

const listar = async ({ indicadorId, unidadeId }, ossIdFiltro = null) => {
  const where = {};
  if (indicadorId) where.indicador_id = indicadorId;
  const include = includeEscopo(ossIdFiltro);
  if (unidadeId) include[0].include[0].where = { unidade_id: unidadeId };
  return db.mapa_producao.findAll({ where, include, order: [['criado_em', 'DESC']] });
};

const criar = async (value, ossIdFiltro = null) => {
  // posse do indicador dentro da OSS do usuário (404 em acesso cruzado)
  await assertIndicadorNoEscopoOSS(value.indicadorId, ossIdFiltro);
  return db.mapa_producao.create({
    indicador_id: value.indicadorId,
    fonte: value.fonte,
    tipo_filtro: value.tipoFiltro,
    valor_filtro: value.valorFiltro,
  });
};

const atualizar = async (mapaId, value, ossIdFiltro = null) => {
  const registro = await db.mapa_producao.findByPk(mapaId, { include: includeEscopo(ossIdFiltro) });
  if (!registro || !registro.indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Mapeamento não encontrado');
  if (value.fonte !== undefined) registro.fonte = value.fonte;
  if (value.tipoFiltro !== undefined) registro.tipo_filtro = value.tipoFiltro;
  if (value.valorFiltro !== undefined) registro.valor_filtro = value.valorFiltro;
  if (value.ativo !== undefined) registro.ativo = value.ativo ? 1 : 0;
  await registro.save();
  return registro;
};

const remover = async (mapaId, ossIdFiltro = null) => {
  const registro = await db.mapa_producao.findByPk(mapaId, { include: includeEscopo(ossIdFiltro) });
  if (!registro || !registro.indicador) throw new ApiError(httpStatus.NOT_FOUND, 'Mapeamento não encontrado');
  await registro.destroy();
};

module.exports = { listar, criar, atualizar, remover };
```

- [ ] **Step 2: Confirmar que `assertIndicadorNoEscopoOSS` existe (ou usar unidade)**

Run: `node -e "const h=require('./src/helper/ossScopeHelper'); console.log(Object.keys(h))"`
Expected: lista contendo `assertIndicadorNoEscopoOSS`. Se **não** existir, usar `assertUnidadeNoEscopoOSS` carregando a unidade do indicador primeiro:

```javascript
const criar = async (value, ossIdFiltro = null) => {
  const ind = await db.indicador.findByPk(value.indicadorId);
  if (!ind) throw new ApiError(httpStatus.NOT_FOUND, 'Indicador não encontrado');
  await assertUnidadeNoEscopoOSS(ind.unidade_id, ossIdFiltro);
  return db.mapa_producao.create({ /* ...igual acima... */ });
};
```

- [ ] **Step 3: Commit**

```bash
git add src/service/MapaProducaoService.js
git commit -m "feat(ponte): service CRUD do mapa com escopo por OSS"
```

---

## Task 7: Controller + rota do mapa, montada em `/api/mapa-producao`

**Files:**
- Create: `src/controllers/MapaProducaoController.js`
- Create: `src/route/mapaProducaoRoute.js`
- Modify: `src/route/index.js`

- [ ] **Step 1: Controller**

```javascript
const httpStatus = require('http-status');
const MapaProducaoService = require('../service/MapaProducaoService');
const { criarMapa, atualizarMapa, listarMapa } = require('../validator/MapaProducaoValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class MapaProducaoController {
  listar = async (req, res, next) => {
    try {
      const { error, value } = listarMapa.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await MapaProducaoService.listar(value, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };

  criar = async (req, res, next) => {
    try {
      const { error, value } = criarMapa.validate(req.body);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await MapaProducaoService.criar(value, ossIdFiltro);
      return res.status(httpStatus.CREATED).json({ status: true, message: 'Mapeamento criado', data });
    } catch (e) { logger.error(e); return next(e); }
  };

  atualizar = async (req, res, next) => {
    try {
      const { error, value } = atualizarMapa.validate(req.body);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await MapaProducaoService.atualizar(req.params.id, value, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, message: 'Mapeamento atualizado', data });
    } catch (e) { logger.error(e); return next(e); }
  };

  remover = async (req, res, next) => {
    try {
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      await MapaProducaoService.remover(req.params.id, ossIdFiltro);
      return res.status(httpStatus.NO_CONTENT).send();
    } catch (e) { logger.error(e); return next(e); }
  };
}

module.exports = MapaProducaoController;
```

- [ ] **Step 2: Rota**

```javascript
const express = require('express');
const MapaProducaoController = require('../controllers/MapaProducaoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new MapaProducaoController();

router.get('/', auth(), checkPermission('relatorios', 'view'), controller.listar);

router.post('/', auth(), checkPermission('relatorios', 'insert'),
  auditar('tb_mapa_producao', 'INSERT'), controller.criar);

router.put('/:id', auth(), checkPermission('relatorios', 'update'),
  auditar('tb_mapa_producao', 'UPDATE'), controller.atualizar);

router.delete('/:id', auth(), checkPermission('relatorios', 'delete'),
  auditar('tb_mapa_producao', 'DELETE'), controller.remover);

module.exports = router;
```

- [ ] **Step 3: Montar em `src/route/index.js`**

Adicionar o require no topo (junto aos outros):
```javascript
const mapaProducaoRoute = require('./mapaProducaoRoute');
```
E a entrada no array `defaultRoutes` (após `/relatorios`):
```javascript
    { path: '/mapa-producao', route: mapaProducaoRoute },
```

- [ ] **Step 4: Verificar que a API sobe e a rota responde 401 sem token**

Run: `npm start &` depois `sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/api/mapa-producao`
Expected: `401` (rota montada, exige auth). Encerrar o processo depois.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/MapaProducaoController.js src/route/mapaProducaoRoute.js src/route/index.js
git commit -m "feat(ponte): rota CRUD /mapa-producao"
```

---

## Task 8: Função pura de comparação + spec

**Files:**
- Create: `src/service/PonteProducaoService.js` (apenas a parte pura nesta task)
- Test: `specs/ponte/comparacao.spec.js`

- [ ] **Step 1: Escrever o spec primeiro (falha — service não existe)**

Create `specs/ponte/comparacao.spec.js`:

```javascript
const { expect } = require('chai');
const { montarComparacao } = require('../../src/service/PonteProducaoService');

describe('montarComparacao', () => {
  const indicadores = [
    { indicador_id: 'A', nome: 'Consultas', unidade_medida: 'atend' },
    { indicador_id: 'B', nome: 'Exames', unidade_medida: 'exames' },
  ];
  const informadoPorIndicador = { A: 100 }; // B sem acompanhamento
  // dois filtros no indicador A somam; B sem mapa
  const produzidoPorIndicador = { A: 90 };
  const temMapa = { A: true };

  it('calcula diferença e divergência quando ambos existem', () => {
    const linhas = montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa });
    const a = linhas.find((l) => l.indicadorId === 'A');
    expect(a.informado).to.equal(100);
    expect(a.registrado).to.equal(90);
    expect(a.diferenca).to.equal(10);
    expect(a.divergenciaPerc).to.be.closeTo(11.11, 0.01);
    expect(a.semMapeamento).to.equal(false);
  });

  it('marca semMapeamento e registrado null quando indicador sem mapa', () => {
    const linhas = montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa });
    const b = linhas.find((l) => l.indicadorId === 'B');
    expect(b.semMapeamento).to.equal(true);
    expect(b.registrado).to.equal(null);
    expect(b.informado).to.equal(null);
    expect(b.diferenca).to.equal(null);
  });
});
```

Run: `npx mocha specs/ponte/comparacao.spec.js --exit`
Expected: FAIL — `Cannot find module` / `montarComparacao is not a function`.

- [ ] **Step 2: Implementar a função pura**

Create `src/service/PonteProducaoService.js` com (por enquanto) só a parte pura:

```javascript
/**
 * Monta as linhas da comparação a partir de dados já carregados (sem DB).
 * @param {{
 *   indicadores: Array<{indicador_id:string, nome:string, unidade_medida:?string}>,
 *   informadoPorIndicador: Record<string, number>,   // valor_realizado
 *   produzidoPorIndicador: Record<string, number>,   // soma SIA/SIH dos filtros
 *   temMapa: Record<string, boolean>,                 // indicador tem ≥1 filtro ativo
 * }}
 */
function montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa }) {
  return indicadores.map((ind) => {
    const id = ind.indicador_id;
    const semMapeamento = !temMapa[id];
    const informado = informadoPorIndicador[id] != null ? informadoPorIndicador[id] : null;
    const registrado = semMapeamento ? null
      : (produzidoPorIndicador[id] != null ? produzidoPorIndicador[id] : 0);
    const ambos = informado != null && registrado != null;
    const diferenca = ambos ? parseFloat((informado - registrado).toFixed(4)) : null;
    const divergenciaPerc = ambos && registrado > 0
      ? parseFloat((((informado - registrado) / registrado) * 100).toFixed(2))
      : null;
    return {
      indicadorId: id,
      nome: ind.nome,
      unidadeMedida: ind.unidade_medida || null,
      informado,
      registrado,
      diferenca,
      divergenciaPerc,
      semMapeamento,
    };
  });
}

module.exports = { montarComparacao };
```

Run: `npx mocha specs/ponte/comparacao.spec.js --exit`
Expected: 2 passing.

- [ ] **Step 3: Commit**

```bash
git add src/service/PonteProducaoService.js specs/ponte/comparacao.spec.js
git commit -m "feat(ponte): funcao pura de comparacao informado x produzido"
```

---

## Task 9: Orquestração DB da comparação (agrega SIA/SIH + informado)

**Files:**
- Modify: `src/service/PonteProducaoService.js`

- [ ] **Step 1: Adicionar a agregação de produção por filtro**

No topo do arquivo adicionar imports:

```javascript
const { QueryTypes, Op } = require('sequelize');
const httpStatus = require('http-status');
const db = require('../models');
const { producaoDb, pingProducao } = require('../config/producaoDb');
const { clausulaFiltro } = require('../helper/filtroProducao');
const ApiError = require('../helper/ApiError');
const { assertUnidadeNoEscopoOSS } = require('../helper/ossScopeHelper');
```

Adicionar a função que soma a produção de um filtro:

```javascript
/** Soma a produção (apresentada) de um filtro para um CNES/competência. */
async function somaProducaoFiltro(cnes, competencia, fonte, tipoFiltro, valorFiltro) {
  const { coluna, operador, valor } = clausulaFiltro(fonte, tipoFiltro, valorFiltro);
  if (fonte === 'sia') {
    const sql = `SELECT COALESCE(SUM(prd_qt_p),0) AS total FROM s_prd
                 WHERE prd_uid = :cnes AND prd_cmp = :cmp AND ${coluna} ${operador} :valor`;
    const [row] = await producaoDb.query(sql, {
      replacements: { cnes, cmp: competencia, valor }, type: QueryTypes.SELECT,
    });
    return Number(row.total) || 0;
  }
  // SIH — detalhe s_aih_pa
  const sql = `SELECT COALESCE(SUM(QUANTIDADE),0) AS total FROM s_aih_pa
               WHERE CNES = :cnes AND COMPETENCIA = :cmp AND ${coluna} ${operador} :valor`;
  const [row] = await producaoDb.query(sql, {
    replacements: { cnes, cmp: competencia, valor }, type: QueryTypes.SELECT,
  });
  return Number(row.total) || 0;
}
```

> Segurança: `coluna`/`operador` vêm só de `clausulaFiltro` (valores fixos do helper), nunca do input cru; `valor`/`cnes`/`cmp` são sempre bindados via `replacements`.

- [ ] **Step 2: Adicionar o orquestrador `comparar`**

```javascript
/**
 * @param {{ unidadeId:string, competencia:string }} params  competencia = 'AAAAMM'
 * @param {string|null} ossIdFiltro
 */
async function comparar({ unidadeId, competencia }, ossIdFiltro = null) {
  if (!/^\d{6}$/.test(competencia)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'competencia deve ser AAAAMM');
  }
  await assertUnidadeNoEscopoOSS(unidadeId, ossIdFiltro);

  const unidade = await db.unidade.findByPk(unidadeId);
  if (!unidade) throw new ApiError(httpStatus.NOT_FOUND, 'Unidade não encontrada');
  if (!unidade.cnes) throw new ApiError(httpStatus.BAD_REQUEST, 'Unidade sem CNES cadastrado');

  if (!(await pingProducao())) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Banco de produção indisponível');
  }

  // indicadores quantitativos ativos da unidade
  const indicadores = await db.indicador.findAll({
    where: { unidade_id: unidadeId, tipo: 'quantitativo', ativo: 1 },
    order: [['nome', 'ASC']],
  });
  const ids = indicadores.map((i) => i.indicador_id);

  // informado: valor_realizado do mês (mes_referencia = AAAA-MM-01)
  const mesRef = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}-01`;
  const acomps = ids.length ? await db.acompanhamento_mensal.findAll({
    where: { indicador_id: { [Op.in]: ids }, mes_referencia: mesRef },
  }) : [];
  const informadoPorIndicador = {};
  for (const a of acomps) {
    if (a.valor_realizado != null) informadoPorIndicador[a.indicador_id] = Number(a.valor_realizado);
  }

  // mapa: filtros ativos por indicador
  const mapas = ids.length ? await db.mapa_producao.findAll({
    where: { indicador_id: { [Op.in]: ids }, ativo: 1 },
  }) : [];
  const filtrosPorIndicador = {};
  for (const m of mapas) (filtrosPorIndicador[m.indicador_id] ||= []).push(m);

  // soma produção por indicador (uma query por filtro)
  const produzidoPorIndicador = {};
  const temMapa = {};
  for (const id of ids) {
    const filtros = filtrosPorIndicador[id] || [];
    temMapa[id] = filtros.length > 0;
    if (!filtros.length) continue;
    let total = 0;
    for (const f of filtros) {
      total += await somaProducaoFiltro(unidade.cnes, competencia, f.fonte, f.tipo_filtro, f.valor_filtro);
    }
    produzidoPorIndicador[id] = total;
  }

  const linhas = montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa });
  return {
    competencia,
    unidade: { id: unidade.unidade_id, nome: unidade.nome, cnes: unidade.cnes },
    linhas,
  };
}

module.exports = { montarComparacao, comparar, somaProducaoFiltro };
```

- [ ] **Step 3: Garantir que os specs puros continuam passando**

Run: `npx mocha specs/ponte/comparacao.spec.js specs/ponte/filtroProducao.spec.js --exit`
Expected: todos passando (a função pura não mudou de assinatura).

- [ ] **Step 4: Commit**

```bash
git add src/service/PonteProducaoService.js
git commit -m "feat(ponte): orquestracao da comparacao com agregacao SIA/SIH"
```

---

## Task 10: Controller + rota da comparação, em `/api/ponte-producao`

**Files:**
- Create: `src/controllers/PonteProducaoController.js`
- Create: `src/route/ponteProducaoRoute.js`
- Modify: `src/route/index.js`

- [ ] **Step 1: Controller**

```javascript
const httpStatus = require('http-status');
const Joi = require('joi');
const PonteProducaoService = require('../service/PonteProducaoService');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

const ID = Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);
const compararSchema = Joi.object({
  unidadeId: ID.required().messages({ 'any.required': 'unidadeId é obrigatório' }),
  competencia: Joi.string().pattern(/^\d{6}$/).required().messages({ 'string.pattern.base': 'competencia deve ser AAAAMM' }),
});

class PonteProducaoController {
  comparar = async (req, res, next) => {
    try {
      const { error, value } = compararSchema.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await PonteProducaoService.comparar(value, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };
}

module.exports = PonteProducaoController;
```

- [ ] **Step 2: Rota**

```javascript
const express = require('express');
const PonteProducaoController = require('../controllers/PonteProducaoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

const router = express.Router();
const controller = new PonteProducaoController();

// Só leitura — sem auditar (não há escrita)
router.get('/', auth(), checkPermission('relatorios', 'view'), controller.comparar);

module.exports = router;
```

- [ ] **Step 3: Montar em `src/route/index.js`**

Require no topo:
```javascript
const ponteProducaoRoute = require('./ponteProducaoRoute');
```
Entrada no `defaultRoutes`:
```javascript
    { path: '/ponte-producao', route: ponteProducaoRoute },
```

- [ ] **Step 4: Teste de fumaça end-to-end (requer dados reais)**

Run: `npm start` em um terminal; em outro, com um token válido de DEV e uma unidade com CNES:
```bash
curl -s "http://localhost:4001/api/ponte-producao?unidadeId=<UUID>&competencia=202501" -H "Authorization: Bearer <TOKEN>"
```
Expected: JSON `{ status:true, data:{ competencia, unidade, linhas:[...] } }`. Sem token → 401. competencia malformada → 400.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/PonteProducaoController.js src/route/ponteProducaoRoute.js src/route/index.js
git commit -m "feat(ponte): rota de comparacao /ponte-producao"
```

---

## Task 11: Tipos do frontend

**Files:**
- Create: `frontend/src/pages/Producao/types.ts`

- [ ] **Step 1: Criar tipos e helpers**

```typescript
export type FonteProducao = 'sia' | 'sih'
export type TipoFiltro = 'grupo' | 'subgrupo' | 'forma' | 'procedimento'

export interface MapaRecord {
  mapa_id: string
  indicador_id: string
  fonte: FonteProducao
  tipo_filtro: TipoFiltro
  valor_filtro: string
  ativo: number
  indicador?: { nome: string; unidade?: { nome: string } }
}

export interface MapaFormData {
  indicadorId: string
  fonte: FonteProducao
  tipoFiltro: TipoFiltro
  valorFiltro: string
}

export interface LinhaComparacao {
  indicadorId: string
  nome: string
  unidadeMedida: string | null
  informado: number | null
  registrado: number | null
  diferenca: number | null
  divergenciaPerc: number | null
  semMapeamento: boolean
}

export interface Comparacao {
  competencia: string
  unidade: { id: string; nome: string; cnes: string }
  linhas: LinhaComparacao[]
}

export const COMPRIMENTO_FILTRO: Record<TipoFiltro, number> = {
  grupo: 2, subgrupo: 4, forma: 6, procedimento: 10,
}

export const TIPO_FILTRO_LABEL: Record<TipoFiltro, string> = {
  grupo: 'Grupo (2 díg)',
  subgrupo: 'Subgrupo (4 díg)',
  forma: 'Forma de organização (6 díg)',
  procedimento: 'Procedimento (10 díg)',
}

export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) return (res as { data: T }).data
  return res as T
}

export function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Producao/types.ts
git commit -m "feat(ponte): tipos do frontend"
```

---

## Task 12: Página de comparação (Ponte de Produção)

**Files:**
- Create: `frontend/src/pages/Producao/PonteProducaoPage.tsx`

- [ ] **Step 1: Criar a página**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import type { Comparacao } from './types'
import { unwrap, fmtNum } from './types'
import type { UnidadeRecord } from '../Unidades/types'

// competência default = mês anterior, formato AAAAMM
function competenciaPadrao(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}
// <input type="month"> usa AAAA-MM; converte dos dois lados
const toMonthInput = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}`
const fromMonthInput = (m: string) => m.replace('-', '')

export default function PonteProducaoPage() {
  const { get } = useApi()
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [competencia, setCompetencia] = useState(competenciaPadrao())
  const [data, setData] = useState<Comparacao | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    get<UnidadeRecord[] | { data: UnidadeRecord[] }>('/unidades?ativo=1')
      .then(r => setUnidades(unwrap(r).map(u => ({ id: u.id, nome: u.nome }))))
      .catch(() => setUnidades([]))
  }, [get])

  const comparar = useCallback(async () => {
    if (!unidadeId) return
    setLoading(true); setErro('')
    try {
      const r = await get<Comparacao | { data: Comparacao }>(
        `/ponte-producao?unidadeId=${unidadeId}&competencia=${competencia}`,
      )
      setData(unwrap(r))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao comparar')
      setData(null)
    } finally { setLoading(false) }
  }, [get, unidadeId, competencia])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-text-primary">Ponte de Produção</h1>
      <p className="text-sm text-text-muted">
        Compara o informado na prestação com a produção registrada (SIA/SIH). A produção pode ter
        defasagem de competência — ajuste o mês se necessário.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text-secondary">Unidade</span>
          <select value={unidadeId} onChange={e => setUnidadeId(e.target.value)}
            className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm">
            <option value="">Selecione…</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text-secondary">Competência</span>
          <input type="month" value={toMonthInput(competencia)}
            onChange={e => setCompetencia(fromMonthInput(e.target.value))}
            className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={comparar} disabled={!unidadeId || loading}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          {loading ? 'Comparando…' : 'Comparar'}
        </button>
      </div>

      {erro && <p className="rounded-lg bg-status-bad-bg px-4 py-2 text-sm text-status-bad">{erro}</p>}

      {data && (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-md">
          <table className="w-full min-w-[720px] text-sm" style={{ minWidth: 720 }}>
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3 text-left">Indicador</th>
                <th className="px-4 py-3 text-right">Informado</th>
                <th className="px-4 py-3 text-right">Registrado</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3 text-right">Divergência</th>
              </tr>
            </thead>
            <tbody>
              {data.linhas.map(l => {
                const alto = l.divergenciaPerc != null && Math.abs(l.divergenciaPerc) > 10
                return (
                  <tr key={l.indicadorId} className="border-b border-border-subtle">
                    <td className="px-4 py-2.5">
                      {l.nome}
                      {l.semMapeamento && (
                        <span className="ml-2 rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-muted">
                          sem mapeamento
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(l.informado)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(l.registrado)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(l.diferenca)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${alto ? 'font-bold text-status-bad' : ''}`}>
                      {l.divergenciaPerc != null ? `${l.divergenciaPerc.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              {data.linhas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Nenhum indicador quantitativo nesta unidade.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero erros. (Se `UnidadeRecord` não tiver `id`/`nome` como usados, ajustar o `.map`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Producao/PonteProducaoPage.tsx
git commit -m "feat(ponte): tela de comparacao informado x produzido"
```

---

## Task 13: Página de cadastro do Mapa de Produção

**Files:**
- Create: `frontend/src/pages/Producao/MapaProducaoPage.tsx`

- [ ] **Step 1: Definir o componente Field FORA do componente da página (não perde foco)**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { MapaRecord, MapaFormData, TipoFiltro, FonteProducao } from './types'
import { unwrap, TIPO_FILTRO_LABEL, COMPRIMENTO_FILTRO } from './types'
import type { UnidadeRecord } from '../Unidades/types'

interface IndicadorOpt { id: string; nome: string }

function SelectField(props: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text-secondary">{props.label}</span>
      <select value={props.value} onChange={e => props.onChange(e.target.value)}
        className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm">
        {props.children}
      </select>
    </label>
  )
}
```

- [ ] **Step 2: Corpo da página — lista + formulário inline de criação**

Continuar o mesmo arquivo:

```tsx
export default function MapaProducaoPage() {
  const { get, post, del } = useApi()
  const { canInsert, canDelete } = usePermission('relatorios')

  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([])
  const [unidadeId, setUnidadeId] = useState('')
  const [indicadores, setIndicadores] = useState<IndicadorOpt[]>([])
  const [lista, setLista] = useState<MapaRecord[]>([])
  const [form, setForm] = useState<MapaFormData>({ indicadorId: '', fonte: 'sia', tipoFiltro: 'grupo', valorFiltro: '' })
  const [erro, setErro] = useState('')

  useEffect(() => {
    get<UnidadeRecord[] | { data: UnidadeRecord[] }>('/unidades?ativo=1')
      .then(r => setUnidades(unwrap(r).map(u => ({ id: u.id, nome: u.nome }))))
      .catch(() => setUnidades([]))
  }, [get])

  const carregar = useCallback(async (uId: string) => {
    if (!uId) { setIndicadores([]); setLista([]); return }
    const ri = await get<IndicadorOpt[] | { data: IndicadorOpt[] }>(`/indicadores?unidadeId=${uId}`)
    setIndicadores(unwrap(ri).map((i: { id: string; nome: string }) => ({ id: i.id, nome: i.nome })))
    const rm = await get<MapaRecord[] | { data: MapaRecord[] }>(`/mapa-producao?unidadeId=${uId}`)
    setLista(unwrap(rm))
  }, [get])

  useEffect(() => { void carregar(unidadeId) }, [unidadeId, carregar])

  const salvar = useCallback(async () => {
    setErro('')
    const len = COMPRIMENTO_FILTRO[form.tipoFiltro]
    if (!/^\d+$/.test(form.valorFiltro) || form.valorFiltro.length !== len) {
      setErro(`Valor deve ter ${len} dígitos para ${form.tipoFiltro}`); return
    }
    try {
      await post('/mapa-producao', form)
      setForm({ ...form, valorFiltro: '' })
      await carregar(unidadeId)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar') }
  }, [form, post, carregar, unidadeId])

  const remover = useCallback(async (id: string) => {
    await del(`/mapa-producao/${id}`)
    setLista(prev => prev.filter(m => m.mapa_id !== id))
  }, [del])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-text-primary">Mapa de Produção</h1>
      <p className="text-sm text-text-muted">
        Liga cada indicador quantitativo a um ou mais filtros SIGTAP (grupo/subgrupo/forma/procedimento)
        para somar a produção registrada. Filtros que se sobrepõem somam em dobro — evite.
      </p>

      <SelectField label="Unidade" value={unidadeId} onChange={setUnidadeId}>
        <option value="">Selecione…</option>
        {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </SelectField>

      {unidadeId && canInsert && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <SelectField label="Indicador" value={form.indicadorId} onChange={v => setForm({ ...form, indicadorId: v })}>
            <option value="">Selecione…</option>
            {indicadores.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </SelectField>
          <SelectField label="Fonte" value={form.fonte} onChange={v => setForm({ ...form, fonte: v as FonteProducao })}>
            <option value="sia">SIA (ambulatorial)</option>
            <option value="sih">SIH (internação)</option>
          </SelectField>
          <SelectField label="Tipo" value={form.tipoFiltro} onChange={v => setForm({ ...form, tipoFiltro: v as TipoFiltro })}>
            {(Object.keys(TIPO_FILTRO_LABEL) as TipoFiltro[]).map(t =>
              <option key={t} value={t}>{TIPO_FILTRO_LABEL[t]}</option>)}
          </SelectField>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-secondary">Código ({COMPRIMENTO_FILTRO[form.tipoFiltro]} díg)</span>
            <input value={form.valorFiltro} inputMode="numeric"
              onChange={e => setForm({ ...form, valorFiltro: e.target.value.replace(/\D/g, '') })}
              maxLength={COMPRIMENTO_FILTRO[form.tipoFiltro]}
              className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm font-mono" />
          </label>
          <button type="button" onClick={salvar} disabled={!form.indicadorId}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
            Adicionar
          </button>
        </div>
      )}

      {erro && <p className="rounded-lg bg-status-bad-bg px-4 py-2 text-sm text-status-bad">{erro}</p>}

      {unidadeId && (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-md">
          <table className="w-full min-w-[640px] text-sm" style={{ minWidth: 640 }}>
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-4 py-3 text-left">Indicador</th>
                <th className="px-4 py-3 text-left">Fonte</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.map(m => (
                <tr key={m.mapa_id} className="border-b border-border-subtle">
                  <td className="px-4 py-2.5">{m.indicador?.nome ?? m.indicador_id}</td>
                  <td className="px-4 py-2.5 uppercase">{m.fonte}</td>
                  <td className="px-4 py-2.5">{m.tipo_filtro}</td>
                  <td className="px-4 py-2.5 font-mono">{m.valor_filtro}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canDelete && (
                      <button type="button" onClick={() => remover(m.mapa_id)}
                        className="rounded-lg px-2 py-1 text-xs text-status-bad hover:bg-status-bad-bg">Remover</button>
                    )}
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Nenhum mapeamento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Producao/MapaProducaoPage.tsx
git commit -m "feat(ponte): tela de cadastro do mapa de producao"
```

---

## Task 14: Rotas + navegação no frontend

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/SidebarMenu.tsx`

- [ ] **Step 1: Registrar as páginas lazy em `App.tsx`**

Após a linha `const PermissoesMatrix   = lazy(...)` adicionar:

```tsx
const PonteProducaoPage  = lazy(() => import('./pages/Producao/PonteProducaoPage'))
const MapaProducaoPage   = lazy(() => import('./pages/Producao/MapaProducaoPage'))
```

- [ ] **Step 2: Adicionar as rotas (guardadas pelo módulo `relatorios`)**

Após a rota `/relatorios` adicionar:

```tsx
        <Route path="/ponte-producao"          element={<Guarded modulo="relatorios"><PonteProducaoPage /></Guarded>} />
        <Route path="/mapa-producao"           element={<Guarded modulo="relatorios"><MapaProducaoPage /></Guarded>} />
```

- [ ] **Step 3: Itens no `SidebarMenu.tsx`**

Importar dois ícones no bloco `lucide-react` (adicionar `GitCompareArrows, Network` à lista de imports). Em `NAV_ITEMS`, após o item `/relatorios`, adicionar:

```tsx
  { to: '/ponte-producao', label: 'Ponte de Produção', icon: <GitCompareArrows size={20} />, modulo: 'relatorios' },
  { to: '/mapa-producao',  label: 'Mapa de Produção',  icon: <Network size={20} />,          modulo: 'relatorios' },
```

- [ ] **Step 4: Type-check + build**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero erros.
Run: `cd frontend && npm run build`
Expected: build conclui sem erro.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/SidebarMenu.tsx
git commit -m "feat(ponte): rotas e navegacao das telas de producao"
```

---

## Task 15: Verificação final ponta a ponta

**Files:** nenhum (validação)

- [ ] **Step 1: Suíte de testes backend relevante**

Run: `npx mocha specs/ponte/*.spec.js --exit`
Expected: todos passando.

- [ ] **Step 2: Self-check do helper**

Run: `node src/helper/filtroProducao.js`
Expected: `OK`.

- [ ] **Step 3: Fluxo manual (DEV)**

1. `npm run dev`; logar.
2. Em **Mapa de Produção**: escolher uma unidade com CNES, adicionar um filtro (ex.: grupo `03` SIA) a um indicador quantitativo.
3. Em **Ponte de Produção**: mesma unidade + uma competência com dados em `s_prd` (ex.: `202501`); clicar Comparar.
Expected: a linha do indicador mostra Informado (se houver acompanhamento), Registrado (soma de `s_prd`), Diferença e Divergência; indicadores sem mapa marcam "sem mapeamento".

- [ ] **Step 4: Confirmar read-only do banco `producao`**

Conferir (revisão de código) que `PonteProducaoService` e `producaoDb` só executam `SELECT`. Nenhum `INSERT/UPDATE/DELETE/CREATE` contra `producaoDb`.

- [ ] **Step 5: Commit final (se houver ajustes)**

```bash
git add -A && git commit -m "test(ponte): verificacao ponta a ponta"
```

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:** conexão read-only (T2), tabela de-para (T4), agregação SIA/SIH com prefixo/igualdade (T3+T9), quantidade apresentada `prd_qt_p`/`SUM(QUANTIDADE)` (T9), informado via `valor_realizado` (T9), comparação/divergência (T8), tela de comparação (T12), CRUD do mapa em tela própria (T13), RBAC `relatorios` + escopo + auditar (T6/T7/T10), erros CNES/503/400 (T9), testes helper+comparação (T3/T8). ✔
- **Fora de escopo mantido fora:** sem export, sem snapshot, sem escrita no `producao`. ✔
- **Consistência de nomes:** `montarComparacao`/`comparar`/`somaProducaoFiltro`, `clausulaFiltro`/`validarValorFiltro`, colunas `prd_uid/prd_cmp/prd_qt_p`, `CNES/COMPETENCIA/PROC_DETALHADO/QUANTIDADE` conferem com o banco real. ✔
- **Ponto de atenção:** `assertIndicadorNoEscopoOSS` pode não existir no helper — T6 Step 2 traz o fallback via `assertUnidadeNoEscopoOSS`.
