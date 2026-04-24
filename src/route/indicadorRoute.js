const express = require('express');
const IndicadorController = require('../controllers/IndicadorController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new IndicadorController();

// ── Leitura — can_view em módulo indicadores ─────────────────────────────────
router.get('/',    auth(), checkPermission('indicadores', 'view'), controller.listar);
router.get('/:id', auth(), checkPermission('indicadores', 'view'), controller.buscarPorId);

// ── Criação — admin e gestor_sms ─────────────────────────────────────────────
router.post(
    '/',
    auth(),
    checkPermission('indicadores', 'insert'),
    auditar('tb_indicadores', 'INSERT'),
    controller.criar,
);

// ── Atualização — admin e gestor_sms ─────────────────────────────────────────
router.put(
    '/:id',
    auth(),
    checkPermission('indicadores', 'update'),
    auditar('tb_indicadores', 'UPDATE'),
    controller.atualizar,
);

// ── Exclusão (soft delete, paranoid: true) — admin e gestor_sms ──────────────
router.delete(
    '/:id',
    auth(),
    checkPermission('indicadores', 'delete'),
    auditar('tb_indicadores', 'DELETE'),
    controller.remover,
);

module.exports = router;
