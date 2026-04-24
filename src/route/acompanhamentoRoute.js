const express = require('express');
const AcompanhamentoController = require('../controllers/AcompanhamentoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new AcompanhamentoController();

router.get('/', auth(), checkPermission('entrada_mensal', 'view'), controller.listar);

router.post(
    '/',
    auth(),
    checkPermission('entrada_mensal', 'insert'),
    auditar('tb_acompanhamento_mensal', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id/aprovar',
    auth(),
    checkPermission('aprovacao', 'update'),
    auditar('tb_acompanhamento_mensal', 'APPROVE'),
    controller.aprovar,
);

router.put(
    '/:id/rejeitar',
    auth(),
    checkPermission('aprovacao', 'update'),
    auditar('tb_acompanhamento_mensal', 'REJECT'),
    controller.rejeitar,
);

router.post(
    '/calcular-descontos',
    auth(),
    checkPermission('entrada_mensal', 'update'),
    controller.calcularDescontos,
);

router.get(
    '/repasse',
    auth(),
    checkPermission('relatorios', 'view'),
    controller.repasse,
);

module.exports = router;
