const express = require('express');
const BackupController = require('../controllers/BackupController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new BackupController();

// Módulo 'backup' é só do admin (migração 20261125100000). view=listar/baixar, insert=gerar, update=restaurar, delete=remover.
router.get('/', auth(), checkPermission('backup', 'view'), controller.listar);

router.post(
    '/gerar',
    auth(),
    checkPermission('backup', 'insert'),
    auditar('backup', 'INSERT'),
    controller.gerar,
);

router.get(
    '/:nome/download',
    auth(),
    checkPermission('backup', 'view'),
    auditarVisualizacao('backup'),
    controller.baixar,
);

router.post(
    '/restaurar',
    auth(),
    checkPermission('backup', 'update'),
    auditar('backup', 'UPDATE'),
    controller.restaurar,
);

router.delete(
    '/:nome',
    auth(),
    checkPermission('backup', 'delete'),
    auditar('backup', 'DELETE'),
    controller.remover,
);

module.exports = router;
