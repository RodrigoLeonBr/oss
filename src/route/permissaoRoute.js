const express = require('express');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');
const PermissaoController = require('../controllers/PermissaoController');

const router = express.Router();
const ctrl = new PermissaoController();

router.get('/:perfil', auth(), checkPermission('permissoes', 'view'), ctrl.getByPerfil);
router.put(
    '/:perfil',
    auth(),
    checkPermission('permissoes', 'update'),
    auditar('tb_permissoes_perfil', 'UPDATE'),
    ctrl.updateBatch,
);

module.exports = router;
