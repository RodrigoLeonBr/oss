const express = require('express');
const UnidadeController = require('../controllers/UnidadeController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new UnidadeController();

router.get('/', auth(), checkPermission('unidades', 'view'), controller.listar);
router.get('/:id', auth(), checkPermission('unidades', 'view'), auditarVisualizacao('tb_unidades'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    checkPermission('unidades', 'insert'),
    auditar('tb_unidades', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    checkPermission('unidades', 'update'),
    auditar('tb_unidades', 'UPDATE'),
    controller.atualizar,
);

router.delete(
    '/:id',
    auth(),
    checkPermission('unidades', 'delete'),
    auditar('tb_unidades', 'DELETE'),
    controller.remover,
);

module.exports = router;
