const express = require('express');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const PermissaoController = require('../controllers/PermissaoController');

const router = express.Router();
const ctrl = new PermissaoController();

router.get('/:perfil', auth(), checkPermission('permissoes', 'view'), ctrl.getByPerfil);
router.put('/:perfil', auth(), checkPermission('permissoes', 'update'), ctrl.updateBatch);

module.exports = router;
