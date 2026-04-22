const express = require('express');
const IndicadorController = require('../controllers/IndicadorController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new IndicadorController();

// ── Leitura — aberta a todos os perfis autenticados ───────────────────────────
router.get('/',    auth(), controller.listar);
router.get('/:id', auth(), controller.buscarPorId);

// ── Criação — admin e gestor_sms ─────────────────────────────────────────────
router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_indicadores', 'INSERT'),
    controller.criar,
);

// ── Atualização — admin e gestor_sms ─────────────────────────────────────────
router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_indicadores', 'UPDATE'),
    controller.atualizar,
);

// ── Exclusão (soft delete, paranoid: true) — admin e gestor_sms ──────────────
router.delete(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_indicadores', 'DELETE'),
    controller.remover,
);

module.exports = router;
