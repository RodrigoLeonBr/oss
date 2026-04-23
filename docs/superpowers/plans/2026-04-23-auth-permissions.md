# Auth & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement session validation, DB-driven per-profile module permissions, and admin UI for user and permission management.

**Architecture:** A new `tb_permissoes_perfil` table stores `can_view/insert/update/delete` + `escopo` per (perfil, modulo) pair. Permissions are fetched from the backend once at login and cached in `AuthContext`. `ProtectedRoute` and action buttons consume `canDo(modulo, action)` from context. Backend validates on write endpoints via `checkPermission` middleware.

**Tech Stack:** Node.js/Express + Sequelize + MySQL (backend), React 18 + TypeScript + Vite (frontend), Passport JWT (auth already working), bcryptjs (passwords already working).

---

## File Map

### New (backend)
- `src/db/migrations/20260423000001-create-tb-permissoes-perfil.js` — table DDL
- `src/db/seeders/20260423100001-seed-permissoes-defaults.js` — default rows
- `src/models/PermissaoPerfil.js` — Sequelize model
- `src/service/PermissaoService.js` — get/upsert permissions
- `src/controllers/PermissaoController.js` — HTTP handlers
- `src/route/permissaoRoute.js` — Express router
- `src/service/UsuarioService.js` — user CRUD (different from old UserService)
- `src/controllers/UsuarioController.js` — HTTP handlers
- `src/route/usuarioRoute.js` — Express router

### Modified (backend)
- `src/controllers/AuthController.js` — fix `refreshTokens`, add `mePermissions`
- `src/route/authRoute.js` — add `GET /me/permissions`
- `src/middlewares/rbac.js` — add `checkPermission(modulo, action)`
- `src/route/index.js` — register `usuarioRoute`, `permissaoRoute`

### New (frontend)
- `frontend/src/hooks/usePermission.ts` — `usePermission(modulo)` hook
- `frontend/src/pages/Admin/types.ts` — admin-specific types
- `frontend/src/pages/Admin/UsuariosFormModal.tsx` — create/edit user modal
- `frontend/src/pages/Admin/UsuariosList.tsx` — users management page
- `frontend/src/pages/Admin/PermissoesMatrix.tsx` — permissions matrix page

### Modified (frontend)
- `frontend/src/types/index.ts` — add `PermissaoPerfil` interface
- `frontend/src/contexts/AuthContext.tsx` — token expiry check, permissions load, `canDo`, `escopo`
- `frontend/src/components/layout/ProtectedRoute.tsx` — modulo-based guard
- `frontend/src/components/SidebarMenu.tsx` — use `canDo` instead of `perfis` arrays
- `frontend/src/App.tsx` — replace `allowedPerfis` with `modulo`, add admin routes

---

## Task 1: Migration — create `tb_permissoes_perfil`

**Files:**
- Create: `src/db/migrations/20260423000001-create-tb-permissoes-perfil.js`

- [ ] **Step 1: Create the migration file**

```js
// src/db/migrations/20260423000001-create-tb-permissoes-perfil.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_permissoes_perfil', {
      perm_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      perfil: {
        type: Sequelize.ENUM(
          'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
          'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador'
        ),
        allowNull: false,
      },
      modulo: { type: Sequelize.STRING(50), allowNull: false },
      can_view:   { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      can_insert: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      can_update: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      can_delete: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      escopo: {
        type: Sequelize.ENUM('global', 'proprio'),
        allowNull: false,
        defaultValue: 'global',
      },
    });

    await queryInterface.addConstraint('tb_permissoes_perfil', {
      fields: ['perfil', 'modulo'],
      type: 'unique',
      name: 'uq_perfil_modulo',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_permissoes_perfil');
  },
};
```

- [ ] **Step 2: Run the migration**

```bash
npm run db:migrate
```

Expected: `20260423000001-create-tb-permissoes-perfil: migrated` in output. No errors.

- [ ] **Step 3: Verify table in DB**

```bash
npx sequelize-cli db:migrate:status
```

Expected: `up` status for the new migration.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/20260423000001-create-tb-permissoes-perfil.js
git commit -m "feat(db): add tb_permissoes_perfil migration"
```

---

## Task 2: Sequelize model — `PermissaoPerfil`

**Files:**
- Create: `src/models/PermissaoPerfil.js`

> `src/models/index.js` auto-loads all `.js` files in the models directory — no manual registration needed.

- [ ] **Step 1: Create the model**

```js
// src/models/PermissaoPerfil.js
const { Model, DataTypes } = require('sequelize');

class PermissaoPerfil extends Model {
  static init(sequelize) {
    return super.init(
      {
        perm_id: {
          type: DataTypes.CHAR(36),
          primaryKey: true,
          defaultValue: sequelize.literal('(UUID())'),
        },
        perfil: {
          type: DataTypes.ENUM(
            'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
            'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador'
          ),
          allowNull: false,
        },
        modulo:     { type: DataTypes.STRING(50), allowNull: false },
        can_view:   { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        can_insert: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        can_update: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        can_delete: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        escopo: {
          type: DataTypes.ENUM('global', 'proprio'),
          allowNull: false,
          defaultValue: 'global',
        },
      },
      {
        sequelize,
        modelName: 'permissaoPerfil',
        tableName: 'tb_permissoes_perfil',
        timestamps: false,
      }
    );
  }
}

module.exports = PermissaoPerfil;
```

- [ ] **Step 2: Verify model loads**

Start the backend and check no Sequelize errors on startup:

```bash
node -e "const models = require('./src/models'); console.log(Object.keys(models));"
```

Expected: output includes `'permissaoPerfil'`.

- [ ] **Step 3: Commit**

```bash
git add src/models/PermissaoPerfil.js
git commit -m "feat(model): add PermissaoPerfil model"
```

---

## Task 3: Seed default permissions

**Files:**
- Create: `src/db/seeders/20260423100001-seed-permissoes-defaults.js`

- [ ] **Step 1: Create the seeder**

```js
// src/db/seeders/20260423100001-seed-permissoes-defaults.js
'use strict';
const { v4: uuidv4 } = require('uuid');

// Translates current hardcoded allowedPerfis from App.tsx into DB rows.
// escopo='proprio' means backend filters by req.user.oss_id.
const DEFAULTS = [
  // ── admin ─────────────────────────────────────────────────────────────────
  { perfil: 'admin', modulo: 'dashboard',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'admin', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'aprovacao',     can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'relatorios',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'admin', modulo: 'perfil_oss',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'admin', modulo: 'oss',           can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'contratos',     can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'unidades',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'indicadores',   can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'metas',         can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'usuarios',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'permissoes',    can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },

  // ── gestor_sms ─────────────────────────────────────────────────────────────
  { perfil: 'gestor_sms', modulo: 'dashboard',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'aprovacao',     can_view: 0, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'relatorios',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'perfil_oss',    can_view: 0, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'oss',           can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'contratos',     can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'unidades',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'indicadores',   can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'metas',         can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'usuarios',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'permissoes',    can_view: 0, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  // ── auditora ───────────────────────────────────────────────────────────────
  { perfil: 'auditora', modulo: 'dashboard',   can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'auditora', modulo: 'aprovacao',   can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'auditora', modulo: 'relatorios',  can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'auditora', modulo: 'indicadores', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  // ── conselheiro_cms ────────────────────────────────────────────────────────
  { perfil: 'conselheiro_cms', modulo: 'relatorios', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  // ── central_regulacao ──────────────────────────────────────────────────────
  { perfil: 'central_regulacao', modulo: 'dashboard',  can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'central_regulacao', modulo: 'relatorios', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  // ── visualizador ───────────────────────────────────────────────────────────
  { perfil: 'visualizador', modulo: 'dashboard',  can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'visualizador', modulo: 'relatorios', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  // ── contratada_scmc ────────────────────────────────────────────────────────
  { perfil: 'contratada_scmc', modulo: 'perfil_oss',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'contratos',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'unidades',      can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'indicadores',   can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'metas',         can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'proprio' },

  // ── contratada_indsh ───────────────────────────────────────────────────────
  { perfil: 'contratada_indsh', modulo: 'perfil_oss',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'contratos',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'unidades',      can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'indicadores',   can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'metas',         can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'proprio' },
];

module.exports = {
  async up(queryInterface) {
    const rows = DEFAULTS.map(r => ({ perm_id: uuidv4(), ...r }));
    await queryInterface.bulkInsert('tb_permissoes_perfil', rows, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_permissoes_perfil', null, {});
  },
};
```

- [ ] **Step 2: Run the seeder**

```bash
npx sequelize-cli db:seed --seed 20260423100001-seed-permissoes-defaults.js
```

Expected: `20260423100001-seed-permissoes-defaults.js: seeded` with no errors.

- [ ] **Step 3: Verify rows**

```bash
node -e "const m=require('./src/models'); m.permissaoPerfil.findAll({where:{perfil:'admin'}}).then(r=>console.log(r.length+' rows for admin'));"
```

Expected: `12 rows for admin`.

- [ ] **Step 4: Commit**

```bash
git add src/db/seeders/20260423100001-seed-permissoes-defaults.js
git commit -m "feat(seed): seed default permissions per perfil"
```

---

## Task 4: `PermissaoService` + `PermissaoController` + route

**Files:**
- Create: `src/service/PermissaoService.js`
- Create: `src/controllers/PermissaoController.js`
- Create: `src/route/permissaoRoute.js`

- [ ] **Step 1: Create `PermissaoService`**

```js
// src/service/PermissaoService.js
const models = require('../models');

const VALID_PERFIS = [
  'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
  'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador',
];

class PermissaoService {
  getPermissoesByPerfil = async (perfil) => {
    return models.permissaoPerfil.findAll({
      where: { perfil },
      order: [['modulo', 'ASC']],
    });
  };

  upsertPermissoesBatch = async (perfil, permissoes) => {
    if (!VALID_PERFIS.includes(perfil)) {
      throw new Error(`Perfil inválido: ${perfil}`);
    }
    const ops = permissoes.map(async (p) => {
      const existing = await models.permissaoPerfil.findOne({
        where: { perfil, modulo: p.modulo },
      });
      if (existing) {
        return existing.update({
          can_view:   p.can_view   ? 1 : 0,
          can_insert: p.can_insert ? 1 : 0,
          can_update: p.can_update ? 1 : 0,
          can_delete: p.can_delete ? 1 : 0,
          escopo:     p.escopo || 'global',
        });
      }
      return models.permissaoPerfil.create({
        perfil,
        modulo:     p.modulo,
        can_view:   p.can_view   ? 1 : 0,
        can_insert: p.can_insert ? 1 : 0,
        can_update: p.can_update ? 1 : 0,
        can_delete: p.can_delete ? 1 : 0,
        escopo:     p.escopo || 'global',
      });
    });
    return Promise.all(ops);
  };
}

module.exports = PermissaoService;
```

- [ ] **Step 2: Create `PermissaoController`**

```js
// src/controllers/PermissaoController.js
const httpStatus = require('http-status');
const PermissaoService = require('../service/PermissaoService');
const logger = require('../config/logger');

class PermissaoController {
  constructor() {
    this.permissaoService = new PermissaoService();
  }

  getByPerfil = async (req, res) => {
    try {
      const rows = await this.permissaoService.getPermissoesByPerfil(req.params.perfil);
      res.status(httpStatus.OK).json({ status: true, data: rows });
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  updateBatch = async (req, res) => {
    try {
      if (!Array.isArray(req.body.permissoes)) {
        return res.status(httpStatus.BAD_REQUEST).json({ status: false, message: 'permissoes deve ser um array.' });
      }
      await this.permissaoService.upsertPermissoesBatch(req.params.perfil, req.body.permissoes);
      res.status(httpStatus.OK).json({ status: true, message: 'Permissões atualizadas.' });
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };
}

module.exports = PermissaoController;
```

- [ ] **Step 3: Create `permissaoRoute`**

```js
// src/route/permissaoRoute.js
const express = require('express');
const auth = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const PermissaoController = require('../controllers/PermissaoController');

const router = express.Router();
const ctrl = new PermissaoController();

router.get('/:perfil', auth(), authorize('admin'), ctrl.getByPerfil);
router.put('/:perfil', auth(), authorize('admin'), ctrl.updateBatch);

module.exports = router;
```

- [ ] **Step 4: Commit**

```bash
git add src/service/PermissaoService.js src/controllers/PermissaoController.js src/route/permissaoRoute.js
git commit -m "feat(permissoes): add PermissaoService, controller and route"
```

---

## Task 5: `UsuarioService` + `UsuarioController` + route

**Files:**
- Create: `src/service/UsuarioService.js`
- Create: `src/controllers/UsuarioController.js`
- Create: `src/route/usuarioRoute.js`

- [ ] **Step 1: Create `UsuarioService`**

```js
// src/service/UsuarioService.js
const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');
const { Op } = require('sequelize');
const models = require('../models');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

const PERFIS_PRIVILEGIADOS = ['admin', 'gestor_sms'];
const PERFIS_CONTRATADA    = ['contratada_scmc', 'contratada_indsh'];

class UsuarioService {
  createUsuario = async (body, callerPerfil) => {
    try {
      if (callerPerfil === 'gestor_sms' && PERFIS_PRIVILEGIADOS.includes(body.perfil)) {
        return responseHandler.returnError(httpStatus.FORBIDDEN, 'gestor_sms não pode criar perfis privilegiados.');
      }
      if (PERFIS_CONTRATADA.includes(body.perfil) && !body.oss_id) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Perfil contratada requer oss_id.');
      }
      const exists = await models.usuario.findOne({ where: { email: body.email.toLowerCase() } });
      if (exists) {
        return responseHandler.returnError(httpStatus.CONFLICT, 'E-mail já cadastrado.');
      }
      const senha_hash = bcrypt.hashSync(body.senha, 10);
      const usuario = await models.usuario.create({
        nome:      body.nome,
        email:     body.email.toLowerCase(),
        cpf:       body.cpf || null,
        telefone:  body.telefone || null,
        perfil:    body.perfil,
        oss_id:    body.oss_id || null,
        senha_hash,
      });
      const data = usuario.toJSON();
      delete data.senha_hash;
      delete data.token_2fa;
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Usuário criado com sucesso.', data);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao criar usuário.');
    }
  };

  listUsuarios = async (callerPerfil) => {
    const where = {};
    if (callerPerfil === 'gestor_sms') {
      where.perfil = { [Op.notIn]: PERFIS_PRIVILEGIADOS };
    }
    const rows = await models.usuario.findAll({
      where,
      include: [{ model: models.oss, as: 'organizacao', attributes: ['oss_id', 'nome'] }],
      order: [['nome', 'ASC']],
    });
    return rows.map(u => {
      const d = u.toJSON();
      delete d.senha_hash;
      delete d.token_2fa;
      return d;
    });
  };

  getUsuarioById = async (id) => {
    const u = await models.usuario.findOne({ where: { usuario_id: id } });
    if (!u) return null;
    const d = u.toJSON();
    delete d.senha_hash;
    delete d.token_2fa;
    return d;
  };

  updateUsuario = async (id, body, callerPerfil) => {
    try {
      const usuario = await models.usuario.findOne({ where: { usuario_id: id } });
      if (!usuario) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Usuário não encontrado.');
      const perfilAlvo = usuario.perfil || usuario.dataValues?.perfil;
      if (callerPerfil === 'gestor_sms' && PERFIS_PRIVILEGIADOS.includes(perfilAlvo)) {
        return responseHandler.returnError(httpStatus.FORBIDDEN, 'gestor_sms não pode alterar perfis privilegiados.');
      }
      const updates = {};
      if (body.nome)                updates.nome      = body.nome;
      if (body.email)               updates.email     = body.email.toLowerCase();
      if (body.telefone !== undefined) updates.telefone = body.telefone;
      if (body.perfil)              updates.perfil    = body.perfil;
      if (body.ativo !== undefined) updates.ativo     = body.ativo ? 1 : 0;
      if (body.oss_id !== undefined) updates.oss_id   = body.oss_id || null;
      if (body.senha)               updates.senha_hash = bcrypt.hashSync(body.senha, 10);
      await usuario.update(updates);
      const data = usuario.toJSON();
      delete data.senha_hash;
      delete data.token_2fa;
      return responseHandler.returnSuccess(httpStatus.OK, 'Usuário atualizado.', data);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao atualizar usuário.');
    }
  };

  deactivateUsuario = async (id) => {
    try {
      const usuario = await models.usuario.findOne({ where: { usuario_id: id } });
      if (!usuario) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Usuário não encontrado.');
      await usuario.update({ ativo: 0 });
      return responseHandler.returnSuccess(httpStatus.OK, 'Usuário desativado.');
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao desativar usuário.');
    }
  };
}

module.exports = UsuarioService;
```

- [ ] **Step 2: Create `UsuarioController`**

```js
// src/controllers/UsuarioController.js
const httpStatus = require('http-status');
const UsuarioService = require('../service/UsuarioService');
const logger = require('../config/logger');

const getCallerPerfil = (user) => user.perfil || user.dataValues?.perfil;

class UsuarioController {
  constructor() {
    this.usuarioService = new UsuarioService();
  }

  list = async (req, res) => {
    try {
      const rows = await this.usuarioService.listUsuarios(getCallerPerfil(req.user));
      res.status(httpStatus.OK).json({ status: true, data: rows });
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  create = async (req, res) => {
    try {
      const result = await this.usuarioService.createUsuario(req.body, getCallerPerfil(req.user));
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  update = async (req, res) => {
    try {
      const result = await this.usuarioService.updateUsuario(
        req.params.id, req.body, getCallerPerfil(req.user),
      );
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  deactivate = async (req, res) => {
    try {
      const result = await this.usuarioService.deactivateUsuario(req.params.id);
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };
}

module.exports = UsuarioController;
```

- [ ] **Step 3: Create `usuarioRoute`**

```js
// src/route/usuarioRoute.js
const express = require('express');
const auth = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const UsuarioController = require('../controllers/UsuarioController');

const router = express.Router();
const ctrl = new UsuarioController();

router.get('/',    auth(), authorize('admin', 'gestor_sms'), ctrl.list);
router.post('/',   auth(), authorize('admin', 'gestor_sms'), ctrl.create);
router.put('/:id', auth(), authorize('admin', 'gestor_sms'), ctrl.update);
router.delete('/:id', auth(), authorize('admin'),            ctrl.deactivate);

module.exports = router;
```

- [ ] **Step 4: Commit**

```bash
git add src/service/UsuarioService.js src/controllers/UsuarioController.js src/route/usuarioRoute.js
git commit -m "feat(usuarios): add UsuarioService, controller and route"
```

---

## Task 6: Register routes + fix AuthController + add `/me/permissions`

**Files:**
- Modify: `src/route/index.js`
- Modify: `src/controllers/AuthController.js`
- Modify: `src/route/authRoute.js`

- [ ] **Step 1: Register new routes in `src/route/index.js`**

Add after the existing imports (lines 1-9) and in the `defaultRoutes` array:

```js
// src/route/index.js  — add these two requires at the top with the others:
const usuarioRoute  = require('./usuarioRoute');
const permissaoRoute = require('./permissaoRoute');
```

Add to `defaultRoutes` array:
```js
{ path: '/usuarios',   route: usuarioRoute },
{ path: '/permissoes', route: permissaoRoute },
```

- [ ] **Step 2: Add `mePermissions` method to `AuthController`**

In `src/controllers/AuthController.js`, add this method to the class (after `changePassword`):

```js
mePermissions = async (req, res) => {
    try {
        const models = require('../models');
        const perfil = req.user.perfil || req.user.dataValues?.perfil;
        const rows = await models.permissaoPerfil.findAll({
            where: { perfil },
            order: [['modulo', 'ASC']],
        });
        res.status(200).json({ status: true, data: rows });
    } catch (e) {
        logger.error(e);
        res.status(500).json({ status: false, message: e.message });
    }
};
```

- [ ] **Step 3: Fix `refreshTokens` in `AuthController`**

Replace the line `const user = await this.userService.getUserByUuid(refreshTokenDoc.user_uuid);` with:

```js
const models = require('../models');
const user = await models.usuario.findOne({
    where: { usuario_id: refreshTokenDoc.user_uuid, ativo: 1 },
});
```

Also update the null check below it from `if (user == null)` — this is already correct, keep it.

- [ ] **Step 4: Add `/me/permissions` route in `src/route/authRoute.js`**

Add after the existing `change-password` route:

```js
router.get('/me/permissions', auth(), authController.mePermissions);
```

- [ ] **Step 5: Verify backend starts and routes exist**

```bash
npm start
```

Then in another terminal:
```bash
curl -s http://localhost:4000/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add src/route/index.js src/controllers/AuthController.js src/route/authRoute.js
git commit -m "feat(auth): register new routes, add me/permissions, fix refreshTokens"
```

---

## Task 7: Add `checkPermission` middleware to `rbac.js`

**Files:**
- Modify: `src/middlewares/rbac.js`

- [ ] **Step 1: Add `checkPermission` to `rbac.js`**

Add after the `verificarAcessoUnidade` function and before `module.exports`:

```js
/**
 * Middleware: verifica permissão de ação no banco.
 * Use em rotas de mutação (POST/PUT/DELETE) para validação granular.
 * @param {string} modulo - e.g. 'contratos'
 * @param {'insert'|'update'|'delete'} action
 */
const checkPermission = (modulo, action) => {
    return async (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(httpStatus.UNAUTHORIZED, 'Autenticação necessária'));
        }
        try {
            const models = require('../models');
            const perfil = req.user.perfil || req.user.dataValues?.perfil;
            const perm = await models.permissaoPerfil.findOne({ where: { perfil, modulo } });
            const col = `can_${action}`;
            if (!perm || !perm[col]) {
                return next(
                    new ApiError(
                        httpStatus.FORBIDDEN,
                        `Perfil '${perfil}' sem permissão de ${action} em ${modulo}.`,
                    ),
                );
            }
            return next();
        } catch (e) {
            return next(e);
        }
    };
};
```

Update `module.exports`:
```js
module.exports = { authorize, verificarAcessoUnidade, checkPermission, PERFIS, PERFIS_CONTRATADA };
```

- [ ] **Step 2: Commit**

```bash
git add src/middlewares/rbac.js
git commit -m "feat(rbac): add checkPermission middleware"
```

---

## Task 8: Frontend types + `AuthContext` updates

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Add `PermissaoPerfil` to `frontend/src/types/index.ts`**

Add at the end of the file:

```ts
export interface PermissaoPerfil {
  perm_id: string
  perfil: Perfil
  modulo: string
  can_view: number
  can_insert: number
  can_update: number
  can_delete: number
  escopo: 'global' | 'proprio'
}
```

> Note: `can_*` fields are `number` (0 or 1) because MySQL TINYINT is returned as number by Sequelize. Use `Boolean(perm.can_view)` or `perm.can_view === 1` to check.

- [ ] **Step 2: Rewrite `frontend/src/contexts/AuthContext.tsx`**

Replace the entire file with:

```tsx
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Usuario, Perfil, PermissaoPerfil } from '../types'

interface AuthState {
  user: Usuario | null
  token: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  permissions: PermissaoPerfil[]
  permissionsLoaded: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  canDo: (modulo: string, action: 'view' | 'insert' | 'update' | 'delete') => boolean
  escopo: (modulo: string) => 'global' | 'proprio' | null
  /** @deprecated Use canDo(modulo, 'view') instead */
  hasPermission: (perfis: Perfil[]) => boolean
  darkMode: boolean
  toggleDarkMode: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_KEY = 'oss_auth'

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp < Math.floor(Date.now() / 1000)
  } catch {
    return true
  }
}

function parseOssAuthFromStorage(): AuthState {
  if (typeof localStorage === 'undefined') {
    return { user: null, token: null, isAuthenticated: false }
  }
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return { user: null, token: null, isAuthenticated: false }
  try {
    const p = JSON.parse(raw) as Partial<AuthState> & Record<string, unknown> | null
    if (!p || typeof p !== 'object') return { user: null, token: null, isAuthenticated: false }
    const token = typeof p.token === 'string' && p.token.trim() ? p.token.trim() : null
    const user = p.user && typeof p.user === 'object' ? p.user as Usuario : null
    if (!token || !user) return { user: null, token: null, isAuthenticated: false }
    // Reject expired tokens immediately — user must re-login
    if (isTokenExpired(token)) {
      localStorage.removeItem(AUTH_KEY)
      return { user: null, token: null, isAuthenticated: false }
    }
    return { user, token, isAuthenticated: true }
  } catch {
    return { user: null, token: null, isAuthenticated: false }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(parseOssAuthFromStorage)
  const [permissions, setPermissions] = useState<PermissaoPerfil[]>([])
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('oss_dark_mode') === 'true',
  )

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('oss_dark_mode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (auth.isAuthenticated) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(AUTH_KEY)
    }
  }, [auth])

  const fetchPermissions = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch('/api/auth/me/permissions', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const body = await res.json() as { data: PermissaoPerfil[] }
      setPermissions(body.data ?? [])
    } catch {
      // Keep empty — canDo will return false for all actions
    } finally {
      setPermissionsLoaded(true)
    }
  }, [])

  // On app load: if session is valid, fetch permissions
  useEffect(() => {
    if (auth.isAuthenticated && auth.token) {
      fetchPermissions(auth.token)
    } else {
      setPermissionsLoaded(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message || 'Credenciais inválidas')
    }
    const body = await res.json()
    const user: Usuario = body.data
    const token: string = body.tokens.access.token
    setPermissionsLoaded(false)
    setAuth({ user, token, isAuthenticated: true })
    await fetchPermissions(token)
  }, [fetchPermissions])

  const logout = useCallback(() => {
    setAuth({ user: null, token: null, isAuthenticated: false })
    setPermissions([])
    setPermissionsLoaded(false)
    localStorage.removeItem(AUTH_KEY)
  }, [])

  const canDo = useCallback(
    (modulo: string, action: 'view' | 'insert' | 'update' | 'delete'): boolean => {
      const key = `can_${action}` as keyof PermissaoPerfil
      const perm = permissions.find(p => p.modulo === modulo)
      if (!perm) return false
      return Boolean(perm[key])
    },
    [permissions],
  )

  const escopo = useCallback(
    (modulo: string): 'global' | 'proprio' | null => {
      const perm = permissions.find(p => p.modulo === modulo)
      return perm ? perm.escopo : null
    },
    [permissions],
  )

  const hasPermission = useCallback(
    (perfis: Perfil[]) => {
      if (!auth.user) return false
      return perfis.includes(auth.user.perfil)
    },
    [auth.user],
  )

  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), [])

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        permissions,
        permissionsLoaded,
        login,
        logout,
        canDo,
        escopo,
        hasPermission,
        darkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/contexts/AuthContext.tsx
git commit -m "feat(auth): add PermissaoPerfil type, token expiry check, permissions in AuthContext"
```

---

## Task 9: `usePermission` hook + update `ProtectedRoute`

**Files:**
- Create: `frontend/src/hooks/usePermission.ts`
- Modify: `frontend/src/components/layout/ProtectedRoute.tsx`

- [ ] **Step 1: Create `usePermission` hook**

```ts
// frontend/src/hooks/usePermission.ts
import { useAuth } from '../contexts/AuthContext'

export function usePermission(modulo: string) {
  const { canDo } = useAuth()
  return {
    canView:   canDo(modulo, 'view'),
    canInsert: canDo(modulo, 'insert'),
    canUpdate: canDo(modulo, 'update'),
    canDelete: canDo(modulo, 'delete'),
  }
}
```

- [ ] **Step 2: Replace `ProtectedRoute`**

```tsx
// frontend/src/components/layout/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  children: React.ReactNode
  modulo: string
}

export default function ProtectedRoute({ children, modulo }: Props) {
  const { isAuthenticated, permissionsLoaded, canDo } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!permissionsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-subtle border-t-primary" />
      </div>
    )
  }

  if (!canDo(modulo, 'view')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-nao-cumprido">403</h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            Acesso não autorizado a este módulo.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePermission.ts frontend/src/components/layout/ProtectedRoute.tsx
git commit -m "feat(frontend): add usePermission hook and modulo-based ProtectedRoute"
```

---

## Task 10: Update `App.tsx` and `SidebarMenu.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/SidebarMenu.tsx`

- [ ] **Step 1: Rewrite `frontend/src/App.tsx`**

```tsx
// frontend/src/App.tsx
import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import SidebarMenu from './components/SidebarMenu'
import Header from './components/layout/Header'
import ProtectedRoute from './components/layout/ProtectedRoute'

const LoginPage          = lazy(() => import('./pages/LoginPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const EntradaMensalHub   = lazy(() => import('./pages/EntradaMensal/EntradaMensalHub'))
const EntradaMensalList  = lazy(() => import('./pages/EntradaMensal/EntradaMensalList'))
const AprovacaoPage      = lazy(() => import('./pages/AprovacaoPage'))
const RelatoriosCMSPage  = lazy(() => import('./pages/RelatoriosCMSPage'))
const PerfilOSSPage      = lazy(() => import('./pages/PerfilOSSPage'))
const OssList            = lazy(() => import('./pages/Oss/OssList'))
const ContratosList      = lazy(() => import('./pages/Contratos/ContratosList'))
const UnidadesList       = lazy(() => import('./pages/Unidades/UnidadesList'))
const IndicadoresList    = lazy(() => import('./pages/Indicadores/IndicadoresList'))
const IndicadoresHub     = lazy(() => import('./pages/Indicadores/IndicadoresHub'))
const MetasHub           = lazy(() => import('./pages/Metas/MetasHub'))
const MetasList          = lazy(() => import('./pages/Metas/MetasList'))
const UsuariosList       = lazy(() => import('./pages/Admin/UsuariosList'))
const PermissoesMatrix   = lazy(() => import('./pages/Admin/PermissoesMatrix'))

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-canvas">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-subtle border-t-primary" />
  </div>
)

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarMenu isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto bg-canvas p-6">{children}</main>
      </div>
    </div>
  )
}

function Guarded({ modulo, children }: { modulo: string; children: React.ReactNode }) {
  return (
    <ProtectedRoute modulo={modulo}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  const { isAuthenticated, canDo } = useAuth()

  const defaultRoute = () => {
    if (!isAuthenticated) return '/login'
    if (canDo('dashboard', 'view')) return '/dashboard'
    if (canDo('relatorios', 'view')) return '/relatorios'
    if (canDo('perfil_oss', 'view')) return '/perfil-oss'
    return '/login'
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard"               element={<Guarded modulo="dashboard">    <DashboardPage />    </Guarded>} />
        <Route path="/entrada-mensal"           element={<Guarded modulo="entrada_mensal"><EntradaMensalHub /></Guarded>} />
        <Route path="/entrada-mensal/:unidadeId" element={<Guarded modulo="entrada_mensal"><EntradaMensalList /></Guarded>} />
        <Route path="/aprovacao"               element={<Guarded modulo="aprovacao">    <AprovacaoPage />    </Guarded>} />
        <Route path="/relatorios"              element={<Guarded modulo="relatorios">   <RelatoriosCMSPage /></Guarded>} />
        <Route path="/perfil-oss"              element={<Guarded modulo="perfil_oss">   <PerfilOSSPage />    </Guarded>} />
        <Route path="/oss/*"                   element={<Guarded modulo="oss">          <OssList />          </Guarded>} />
        <Route path="/contratos/*"             element={<Guarded modulo="contratos">    <ContratosList />    </Guarded>} />
        <Route path="/unidades/*"              element={<Guarded modulo="unidades">     <UnidadesList />     </Guarded>} />
        <Route path="/indicadores"             element={<Guarded modulo="indicadores">  <IndicadoresHub />   </Guarded>} />
        <Route path="/indicadores/:unidadeId/*" element={<Guarded modulo="indicadores"> <IndicadoresList />  </Guarded>} />
        <Route path="/metas"                   element={<Guarded modulo="metas">        <MetasHub />         </Guarded>} />
        <Route path="/metas/:indicadorId/*"    element={<Guarded modulo="metas">        <MetasList />        </Guarded>} />
        <Route path="/admin/usuarios"          element={<Guarded modulo="usuarios">     <UsuariosList />     </Guarded>} />
        <Route path="/admin/permissoes"        element={<Guarded modulo="permissoes">   <PermissoesMatrix /> </Guarded>} />

        <Route path="*" element={<Navigate to={defaultRoute()} replace />} />
      </Routes>
    </Suspense>
  )
}
```

- [ ] **Step 2: Rewrite `SidebarMenu.tsx` to use `canDo` instead of `perfis` arrays**

Replace the entire file with the version below. Key changes: `NavItem.perfis` → `NavItem.modulo`; `MenuGroup.perfis` removed; `canView` uses `canDo(modulo,'view')`; add Admin group; remove `userPerfil` prop.

```tsx
// frontend/src/components/SidebarMenu.tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardEdit, ShieldCheck, FileBarChart2,
  Building2, Building, FileText, Hospital, Target, BarChart3,
  ChevronDown, X, Heart, Users, Shield, Settings,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  modulo: string
  end?: boolean
}

interface SubMenuItem {
  to: string
  label: string
  icon: React.ReactNode
  modulo: string
}

interface MenuGroup {
  id: string
  label: string
  icon: React.ReactNode
  subItems: SubMenuItem[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',    label: 'Dashboard',     icon: <LayoutDashboard size={20} />, modulo: 'dashboard' },
  { to: '/entrada-mensal', label: 'Entrada Mensal', icon: <ClipboardEdit size={20} />, modulo: 'entrada_mensal' },
  { to: '/aprovacao',    label: 'Aprovação',     icon: <ShieldCheck size={20} />,    modulo: 'aprovacao' },
  { to: '/relatorios',   label: 'Relatórios CMS', icon: <FileBarChart2 size={20} />, modulo: 'relatorios' },
  { to: '/perfil-oss',   label: 'Perfil OSS',    icon: <Building2 size={20} />,      modulo: 'perfil_oss' },
]

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <Building size={20} />,
    subItems: [
      { to: '/oss',         label: 'Organizações Sociais',    icon: <Building size={14} />,  modulo: 'oss' },
      { to: '/contratos',   label: 'Contratos de Gestão',     icon: <FileText size={14} />,  modulo: 'contratos' },
      { to: '/unidades',    label: 'Unidades de Saúde',       icon: <Hospital size={14} />,  modulo: 'unidades' },
      { to: '/indicadores', label: 'Indicadores por Unidade', icon: <BarChart3 size={14} />, modulo: 'indicadores' },
      { to: '/metas',       label: 'Metas Anuais',            icon: <Target size={14} />,    modulo: 'metas' },
    ],
  },
  {
    id: 'admin',
    label: 'Administração',
    icon: <Settings size={20} />,
    subItems: [
      { to: '/admin/usuarios',   label: 'Usuários',   icon: <Users size={14} />,  modulo: 'usuarios' },
      { to: '/admin/permissoes', label: 'Permissões', icon: <Shield size={14} />, modulo: 'permissoes' },
    ],
  },
]

const SidebarMenu: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { user, canDo } = useAuth()
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = MENU_GROUPS.find(g =>
      g.subItems.some(s => location.pathname.startsWith(s.to)),
    )
    return active ? new Set([active.id]) : new Set()
  })

  const onToggleRef = useRef(onToggle)
  onToggleRef.current = onToggle
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  useEffect(() => {
    if (isOpenRef.current && window.innerWidth < 768) {
      onToggleRef.current()
    }
  }, [location.pathname])

  const canViewModulo = useCallback(
    (modulo: string): boolean => canDo(modulo, 'view'),
    [canDo],
  )

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleLinkClick = useCallback(() => {
    if (window.innerWidth < 768 && isOpenRef.current) {
      onToggleRef.current()
    }
  }, [])

  const handleNavKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (!navRef.current) return
    const focusable = Array.from(
      navRef.current.querySelectorAll<HTMLElement>('button[data-navitem], a[data-navitem]'),
    ).filter(el => !el.closest('[hidden]'))
    const idx = focusable.indexOf(document.activeElement as HTMLElement)
    if (idx === -1) return
    e.preventDefault()
    if (e.key === 'ArrowDown') focusable[Math.min(idx + 1, focusable.length - 1)]?.focus()
    else focusable[Math.max(idx - 1, 0)]?.focus()
  }, [])

  const visibleItems  = NAV_ITEMS.filter(item => canViewModulo(item.modulo))
  const visibleGroups = MENU_GROUPS
    .map(g => ({ ...g, subItems: g.subItems.filter(s => canViewModulo(s.modulo)) }))
    .filter(g => g.subItems.length > 0)

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      <aside
        id="sidebar-menu"
        aria-label="Menu de navegação principal"
        className={[
          'fixed left-0 top-0 z-50 flex h-screen w-64 md:w-72 flex-col',
          'bg-gradient-to-b from-blue-50 to-indigo-100',
          'dark:from-slate-900/95 dark:to-slate-900',
          'border-r border-blue-200 dark:border-slate-700',
          'overflow-hidden',
          'transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0 md:z-auto md:left-auto md:top-auto',
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-blue-200 dark:border-slate-700 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <Heart size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-blue-900 dark:text-white">OSS Saúde</p>
              <p className="truncate text-[10px] leading-tight text-blue-500 dark:text-slate-400">Americana / SP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Fechar menu lateral"
            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* User badge */}
        {user && (
          <div className="mx-3 mt-3 shrink-0 rounded-lg border border-blue-100 bg-white/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="truncate text-xs font-semibold text-blue-900 dark:text-white">{user.nome}</p>
            <p className="truncate text-[10px] capitalize text-blue-500 dark:text-slate-400">
              {user.perfil.replace(/_/g, ' ')}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav
          ref={navRef}
          aria-label="Menu principal"
          className="flex-1 overflow-y-auto px-2 py-3"
          onKeyDown={handleNavKeyDown}
        >
          {visibleItems.length > 0 && (
            <ul role="list" className="space-y-0.5">
              {visibleItems.map(item => (
                <li key={item.to} role="listitem">
                  <NavLink
                    data-navitem
                    to={item.to}
                    end={item.end !== false}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                        isActive
                          ? 'bg-blue-200 font-bold text-blue-900 dark:bg-slate-700 dark:text-white'
                          : 'text-blue-800 hover:bg-blue-100/50 dark:text-slate-300 dark:hover:bg-slate-800/50',
                      ].join(' ')
                    }
                  >
                    <span className="shrink-0 text-blue-400 dark:text-slate-500">{item.icon}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}

          {visibleItems.length > 0 && visibleGroups.length > 0 && (
            <div className="my-2 border-t border-blue-200 dark:border-slate-700" role="separator" />
          )}

          <ul role="list" className="space-y-0.5">
            {visibleGroups.map(group => {
              const isExpanded = openGroups.has(group.id)
              const isGroupActive = group.subItems.some(s => location.pathname.startsWith(s.to))
              return (
                <li key={group.id} role="listitem">
                  <button
                    data-navitem
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setOpenGroups(prev => { const n = new Set(prev); n.delete(group.id); return n })
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`submenu-${group.id}`}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                      isGroupActive && !isExpanded
                        ? 'bg-blue-200 font-bold text-blue-900 dark:bg-slate-700 dark:text-white'
                        : 'text-blue-800 hover:bg-blue-100/50 dark:text-slate-300 dark:hover:bg-slate-800/50',
                    ].join(' ')}
                  >
                    <span className={isGroupActive ? 'shrink-0 text-blue-600 dark:text-blue-400' : 'shrink-0 text-blue-400 dark:text-slate-500'}>
                      {group.icon}
                    </span>
                    <span className="flex-1 text-left leading-snug">{group.label}</span>
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={['shrink-0 text-blue-400 transition-transform duration-200 dark:text-slate-500', isExpanded ? 'rotate-180' : ''].join(' ')}
                    />
                  </button>
                  <div id={`submenu-${group.id}`} role="group" aria-label={`Submenu de ${group.label}`} hidden={!isExpanded}>
                    {isExpanded && (
                      <ul role="list" className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-blue-200 pl-3 dark:border-slate-700">
                        {group.subItems.map(item => (
                          <li key={item.to} role="listitem">
                            <NavLink
                              data-navitem
                              to={item.to}
                              end={false}
                              onClick={handleLinkClick}
                              className={({ isActive }) =>
                                [
                                  'flex items-center gap-2 rounded-md px-2.5 py-[7px] text-xs transition-all duration-150',
                                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                                  isActive
                                    ? 'bg-blue-200 font-bold text-blue-900 dark:bg-slate-700 dark:text-white'
                                    : 'font-medium text-blue-700 hover:bg-blue-100/50 hover:text-blue-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white',
                                ].join(' ')
                              }
                              aria-label={item.label}
                            >
                              <span className="shrink-0 text-blue-400 dark:text-slate-500">{item.icon}</span>
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-blue-200 px-4 py-3 dark:border-slate-700">
          <p className="text-[10px] text-blue-400 dark:text-slate-500">v1.0.0 MVP · Americana / SP</p>
        </div>
      </aside>
    </>
  )
}

export default SidebarMenu
```

- [ ] **Step 3: Build check — expect no errors**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/SidebarMenu.tsx
git commit -m "feat(frontend): replace hardcoded allowedPerfis with DB-driven modulo guards"
```

---

## Task 11: Admin — types + `UsuariosFormModal`

**Files:**
- Create: `frontend/src/pages/Admin/types.ts`
- Create: `frontend/src/pages/Admin/UsuariosFormModal.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Admin/types.ts`**

```ts
// frontend/src/pages/Admin/types.ts
import type { Perfil, Usuario, PermissaoPerfil } from '../../types'

export type { Usuario, PermissaoPerfil }

export const PERFIS_LIST: Perfil[] = [
  'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
  'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador',
]

export const PERFIL_LABELS: Record<Perfil, string> = {
  admin:              'Administrador',
  gestor_sms:         'Gestor SMS',
  auditora:           'Auditora',
  conselheiro_cms:    'Conselheiro CMS',
  contratada_scmc:    'Contratada SCMC',
  contratada_indsh:   'Contratada INDSH',
  central_regulacao:  'Central de Regulação',
  visualizador:       'Visualizador',
}

export const MODULOS_LIST = [
  'dashboard', 'entrada_mensal', 'aprovacao', 'relatorios',
  'perfil_oss', 'oss', 'contratos', 'unidades',
  'indicadores', 'metas', 'usuarios', 'permissoes',
] as const

export const MODULO_LABELS: Record<string, string> = {
  dashboard:     'Dashboard',
  entrada_mensal:'Entrada Mensal',
  aprovacao:     'Aprovação',
  relatorios:    'Relatórios CMS',
  perfil_oss:    'Perfil OSS',
  oss:           'Organizações Sociais',
  contratos:     'Contratos de Gestão',
  unidades:      'Unidades de Saúde',
  indicadores:   'Indicadores',
  metas:         'Metas Anuais',
  usuarios:      'Usuários',
  permissoes:    'Permissões',
}

export interface UsuarioFormData {
  nome: string
  email: string
  perfil: Perfil
  oss_id: string
  telefone: string
  senha: string
  ativo: boolean
}
```

- [ ] **Step 2: Create `frontend/src/pages/Admin/UsuariosFormModal.tsx`**

```tsx
// frontend/src/pages/Admin/UsuariosFormModal.tsx
import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Perfil, Usuario } from '../../types'
import type { UsuarioFormData } from './types'
import { PERFIS_LIST, PERFIL_LABELS } from './types'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'
import type { Oss } from '../../types'

interface Props {
  usuario: Usuario | null  // null = create mode
  onClose: () => void
  onSaved: () => void
}

const PRIVILEGIADOS: Perfil[] = ['admin', 'gestor_sms']

export default function UsuariosFormModal({ usuario, onClose, onSaved }: Props) {
  const { post, put } = useApi()
  const { user: currentUser } = useAuth()
  const isEdit = usuario !== null

  const [form, setForm] = useState<UsuarioFormData>({
    nome:     usuario?.nome     ?? '',
    email:    usuario?.email    ?? '',
    perfil:   usuario?.perfil   ?? 'visualizador',
    oss_id:   usuario?.oss_id   ?? '',
    telefone: usuario?.telefone ?? '',
    senha:    '',
    ativo:    usuario?.ativo    ?? true,
  })
  const [oss, setOss] = useState<Oss[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { get } = useApi()

  useEffect(() => {
    get<{ data: Oss[] }>('/oss').then(r => setOss(r.data ?? [])).catch(() => {})
  }, [get])

  const perfisDispo = PERFIS_LIST.filter(p =>
    currentUser?.perfil === 'admin' ? true : !PRIVILEGIADOS.includes(p)
  )

  const needsOss = ['contratada_scmc', 'contratada_indsh'].includes(form.perfil)

  const set = (k: keyof UsuarioFormData, v: unknown) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isEdit && !form.senha) { setError('Senha obrigatória para novo usuário.'); return }
    if (needsOss && !form.oss_id) { setError('OSS obrigatória para perfil contratada.'); return }
    setLoading(true)
    try {
      const payload = { ...form, oss_id: form.oss_id || undefined }
      if (isEdit) {
        await put(`/usuarios/${usuario!.usuario_id}`, payload)
      } else {
        await post('/usuarios', payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Nome *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">E-mail *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Perfil *</label>
              <select
                value={form.perfil}
                onChange={e => set('perfil', e.target.value as Perfil)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                {perfisDispo.map(p => (
                  <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={e => set('telefone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {needsOss && (
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">OSS vinculada *</label>
                <select
                  value={form.oss_id}
                  onChange={e => set('oss_id', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {oss.map(o => (
                    <option key={o.oss_id} value={o.oss_id}>{o.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {isEdit ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha *'}
              </label>
              <input
                type="password"
                value={form.senha}
                onChange={e => set('senha', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {isEdit && (
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={e => set('ativo', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary"
                />
                <label htmlFor="ativo" className="text-sm text-slate-700 dark:text-slate-300">Usuário ativo</label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin/types.ts frontend/src/pages/Admin/UsuariosFormModal.tsx
git commit -m "feat(admin): add user form modal and admin types"
```

---

## Task 12: Admin — `UsuariosList` page

**Files:**
- Create: `frontend/src/pages/Admin/UsuariosList.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Admin/UsuariosList.tsx`**

```tsx
// frontend/src/pages/Admin/UsuariosList.tsx
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, UserX, UserCheck, RefreshCw } from 'lucide-react'
import type { Usuario } from '../../types'
import { PERFIL_LABELS } from './types'
import UsuariosFormModal from './UsuariosFormModal'
import { useApi } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'

export default function UsuariosList() {
  const { get, del } = useApi()
  const { canInsert, canUpdate, canDelete } = usePermission('usuarios')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editTarget, setEditTarget] = useState<Usuario | null | undefined>(undefined) // undefined = modal closed

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get<{ data: Usuario[] }>('/usuarios')
      setUsuarios(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { load() }, [load])

  const handleToggleAtivo = async (u: Usuario) => {
    try {
      const { put } = useApi()  // eslint-disable-line react-hooks/rules-of-hooks
      // Note: useApi() at top level; access put from the outer const
    } catch {}
  }

  const handleDeactivate = async (id: string) => {
    if (!window.confirm('Desativar este usuário?')) return
    try {
      await del(`/usuarios/${id}`)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao desativar.')
    }
  }

  const perfilBadge = (perfil: string) => (
    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      {PERFIL_LABELS[perfil] ?? perfil}
    </span>
  )

  const ativoBadge = (ativo: boolean) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      ativo
        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Usuários</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} />
          </button>
          {canInsert && (
            <button
              onClick={() => setEditTarget(null)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Plus size={16} />
              Novo Usuário
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {['Nome', 'E-mail', 'Perfil', 'Status', 'Último Acesso', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/50">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">Carregando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">Nenhum usuário encontrado.</td></tr>
            ) : (
              usuarios.map(u => (
                <tr key={u.usuario_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{u.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">{perfilBadge(u.perfil)}</td>
                  <td className="px-4 py-3">{ativoBadge(u.ativo)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {canUpdate && (
                        <button
                          onClick={() => setEditTarget(u)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && u.ativo && (
                        <button
                          onClick={() => handleDeactivate(u.usuario_id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Desativar"
                        >
                          <UserX size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editTarget !== undefined && (
        <UsuariosFormModal
          usuario={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSaved={() => { setEditTarget(undefined); load() }}
        />
      )}
    </div>
  )
}
```

> **Note on `handleToggleAtivo`:** The pattern above has a stub. Remove it entirely — the delete button calls `handleDeactivate` via the API. Replace the `handleToggleAtivo` function and remove the `UserCheck` import if unused.

Clean version — replace `handleToggleAtivo` stub and remove unused imports. Final clean file should not have `UserCheck` or `handleToggleAtivo`:

Remove `UserCheck` from the import line and remove the `handleToggleAtivo` function entirely. The file above already has `handleDeactivate` which is what the button uses.

- [ ] **Step 2: Fix the file — remove `UserCheck` and `handleToggleAtivo` stub**

In the import line, change:
```tsx
import { Plus, Pencil, UserX, UserCheck, RefreshCw } from 'lucide-react'
```
to:
```tsx
import { Plus, Pencil, UserX, RefreshCw } from 'lucide-react'
```

Remove the entire `handleToggleAtivo` function.

- [ ] **Step 3: Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin/UsuariosList.tsx
git commit -m "feat(admin): add UsuariosList page"
```

---

## Task 13: Admin — `PermissoesMatrix` page

**Files:**
- Create: `frontend/src/pages/Admin/PermissoesMatrix.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Admin/PermissoesMatrix.tsx`**

```tsx
// frontend/src/pages/Admin/PermissoesMatrix.tsx
import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import type { Perfil, PermissaoPerfil } from '../../types'
import { PERFIS_LIST, PERFIL_LABELS, MODULOS_LIST, MODULO_LABELS } from './types'
import { useApi } from '../../hooks/useApi'

interface RowState {
  modulo: string
  can_view: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
  escopo: 'global' | 'proprio'
}

function buildEmptyRows(): RowState[] {
  return MODULOS_LIST.map(m => ({
    modulo: m,
    can_view: false,
    can_insert: false,
    can_update: false,
    can_delete: false,
    escopo: 'global',
  }))
}

function mergePermissoes(rows: RowState[], perms: PermissaoPerfil[]): RowState[] {
  return rows.map(r => {
    const p = perms.find(x => x.modulo === r.modulo)
    if (!p) return r
    return {
      modulo:     p.modulo,
      can_view:   Boolean(p.can_view),
      can_insert: Boolean(p.can_insert),
      can_update: Boolean(p.can_update),
      can_delete: Boolean(p.can_delete),
      escopo:     p.escopo,
    }
  })
}

export default function PermissoesMatrix() {
  const { get, put } = useApi()
  const [perfil, setPerfil] = useState<Perfil>('admin')
  const [rows, setRows] = useState<RowState[]>(buildEmptyRows())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = useCallback(async (p: Perfil) => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await get<{ data: PermissaoPerfil[] }>(`/permissoes/${p}`)
      setRows(mergePermissoes(buildEmptyRows(), res.data ?? []))
    } catch {
      setRows(buildEmptyRows())
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { load(perfil) }, [perfil, load])

  const toggle = (modulo: string, field: keyof Omit<RowState, 'modulo' | 'escopo'>) => {
    setRows(prev => prev.map(r => r.modulo === modulo ? { ...r, [field]: !r[field] } : r))
  }

  const setEscopo = (modulo: string, v: 'global' | 'proprio') => {
    setRows(prev => prev.map(r => r.modulo === modulo ? { ...r, escopo: v } : r))
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      await put(`/permissoes/${perfil}`, { permissoes: rows })
      setFeedback({ type: 'success', msg: 'Permissões salvas com sucesso.' })
    } catch (e) {
      setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  const Chk = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Permissões por Perfil</h1>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>

      {feedback && (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          feedback.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {feedback.msg}
        </p>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Perfil:</label>
        <select
          value={perfil}
          onChange={e => setPerfil(e.target.value as Perfil)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          {PERFIS_LIST.map(p => (
            <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 w-48">
                Módulo
              </th>
              {['Visualizar', 'Inserir', 'Alterar', 'Excluir'].map(h => (
                <th key={h} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Escopo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.modulo} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {MODULO_LABELS[row.modulo] ?? row.modulo}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_view}   onChange={() => toggle(row.modulo, 'can_view')} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_insert} onChange={() => toggle(row.modulo, 'can_insert')} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_update} onChange={() => toggle(row.modulo, 'can_update')} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_delete} onChange={() => toggle(row.modulo, 'can_delete')} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.escopo}
                      onChange={e => setEscopo(row.modulo, e.target.value as 'global' | 'proprio')}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="global">Global</option>
                      <option value="proprio">Próprio</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Admin/PermissoesMatrix.tsx
git commit -m "feat(admin): add PermissoesMatrix page"
```

---

## Task 14: End-to-end smoke test

- [ ] **Step 1: Start backend**

```bash
npm start
```

Expected: server starts on port configured in `.env`, no errors.

- [ ] **Step 2: Start frontend dev server**

```bash
cd frontend && npm run dev
```

Expected: Vite starts, no build errors.

- [ ] **Step 3: Login flow**

1. Open browser at `http://localhost:5173`
2. You should be redirected to `/login`
3. Enter credentials: `admin@americana.sp.gov.br` + correct password
4. Expected: redirected to `/dashboard`
5. Check browser DevTools Network tab — `GET /api/auth/me/permissions` should return 200 with 12 rows for `admin`

- [ ] **Step 4: Session expiry**

1. Open DevTools → Application → Local Storage → find `oss_auth`
2. Edit the `token` value — modify any character to corrupt it
3. Reload the page
4. Expected: immediately redirected to `/login`

- [ ] **Step 5: Protected route**

1. Log in as `admin`
2. Navigate to `/admin/usuarios` — should load user list
3. Navigate to `/admin/permissoes` — should load permission matrix
4. Log in as `conselheiro_cms` (has only `relatorios` view permission)
5. Try to navigate to `/dashboard` — should see 403
6. Navigate to `/relatorios` — should load

- [ ] **Step 6: Permission matrix**

1. Log in as `admin`
2. Go to `/admin/permissoes`
3. Select `visualizador` from dropdown
4. Check `Inserir` on `relatorios`
5. Click Salvar — expected: "Permissões salvas com sucesso."
6. Log in as `visualizador` user
7. Navigate to `/relatorios` — should load

- [ ] **Step 7: User management**

1. Log in as `admin`
2. Go to `/admin/usuarios`
3. Click "Novo Usuário"
4. Fill: nome="Teste", email="teste@test.com", perfil="visualizador", senha="Senha123!"
5. Click "Criar Usuário"
6. Expected: modal closes, user appears in list

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete auth & permissions implementation"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Session validation (Task 8), per-perfil DB permissions (Tasks 1-4), route guards (Tasks 9-10), admin user CRUD (Tasks 5,11,12), permissions matrix UI (Task 13), escopo support (Tasks 3,4)
- [x] **Placeholder scan:** No TBD/TODO found in plan
- [x] **Type consistency:** `PermissaoPerfil` defined in Task 8 Step 1, used in AuthContext (Task 8 Step 2), `usePermission` (Task 9), `PermissoesMatrix` (Task 13). `UsuarioFormData` defined in Task 11 Step 1, used in `UsuariosFormModal` same task.
- [x] **Method names:** `canDo` defined in AuthContext Task 8, called in `ProtectedRoute` Task 9, `SidebarMenu` Task 10. `usePermission` created Task 9, used in `UsuariosList` Task 12. `upsertPermissoesBatch` defined in `PermissaoService` Task 4, called in `PermissaoController` Task 4.
- [x] **Known issue in Task 12:** `handleToggleAtivo` stub was identified and Step 2 instructs removal. The `del` call in `handleDeactivate` correctly uses the outer-scope `del` from `useApi()`.
