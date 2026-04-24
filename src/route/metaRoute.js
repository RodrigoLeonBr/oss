const express = require('express');
const MetaController = require('../controllers/MetaController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new MetaController();

// ── Leitura — can_view em módulo metas ────────────────────────────────────────
router.get('/',    auth(), checkPermission('metas', 'view'), controller.listar);
router.get('/:id', auth(), checkPermission('metas', 'view'), controller.buscarPorId);

// ── Criação ───────────────────────────────────────────────────────────────────
router.post(
    '/pacote',
    auth(),
    checkPermission('metas', 'insert'),
    auditar('tb_metas', 'INSERT'),
    controller.criarPacote,
);
router.post(
    '/',
    auth(),
    checkPermission('metas', 'insert'),
    auditar('tb_metas', 'INSERT'),
    controller.criar,
);

// ── Atualização ───────────────────────────────────────────────────────────────
router.put(
    '/:id',
    auth(),
    checkPermission('metas', 'update'),
    auditar('tb_metas', 'UPDATE'),
    controller.atualizar,
);

// ── Exclusão ──────────────────────────────────────────────────────────────────
router.delete(
    '/:id',
    auth(),
    checkPermission('metas', 'delete'),
    auditar('tb_metas', 'DELETE'),
    controller.remover,
);

module.exports = router;
