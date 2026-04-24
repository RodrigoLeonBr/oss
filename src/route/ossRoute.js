const express = require('express');
const OssController = require('../controllers/OssController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new OssController();

router.get('/', auth(), checkPermission('oss', 'view'), controller.listar);
router.get('/:id', auth(), checkPermission('oss', 'view'), auditarVisualizacao('tb_oss'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    checkPermission('oss', 'insert'),
    auditar('tb_oss', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    checkPermission('oss', 'update'),
    auditar('tb_oss', 'UPDATE'),
    controller.atualizar,
);

router.delete(
    '/:id',
    auth(),
    checkPermission('oss', 'delete'),
    auditar('tb_oss', 'DELETE'),
    controller.remover,
);

module.exports = router;
