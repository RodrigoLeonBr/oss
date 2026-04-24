const express = require('express');
const ContratoController = require('../controllers/ContratoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new ContratoController();

router.get('/', auth(), checkPermission('contratos', 'view'), controller.listar);
router.get('/:id', auth(), checkPermission('contratos', 'view'), auditarVisualizacao('tb_contratos'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    checkPermission('contratos', 'insert'),
    auditar('tb_contratos', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    checkPermission('contratos', 'update'),
    auditar('tb_contratos', 'UPDATE'),
    controller.atualizar,
);

router.delete(
    '/:id',
    auth(),
    checkPermission('contratos', 'delete'),
    auditar('tb_contratos', 'DELETE'),
    controller.excluir,
);

router.post(
    '/:id/aditivos',
    auth(),
    checkPermission('contratos', 'insert'),
    auditar('tb_aditivos', 'INSERT'),
    controller.adicionarAditivo,
);

router.post(
    '/:id/aditivos/:aditivoId/aplicar',
    auth(),
    checkPermission('contratos', 'update'),
    auditar('tb_aditivos', 'UPDATE'),
    controller.aplicarAditivo,
);

module.exports = router;
