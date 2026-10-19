const express = require('express');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');
const UsuarioController = require('../controllers/UsuarioController');

const router = express.Router();
const ctrl = new UsuarioController();

router.get('/',    auth(), checkPermission('usuarios', 'view'), ctrl.list);
router.post('/',   auth(), checkPermission('usuarios', 'insert'), auditar('tb_usuarios', 'INSERT'), ctrl.create);
router.put('/:id', auth(), checkPermission('usuarios', 'update'), auditar('tb_usuarios', 'UPDATE'), ctrl.update);
router.delete('/:id', auth(), checkPermission('usuarios', 'delete'), auditar('tb_usuarios', 'DELETE'), ctrl.deactivate);

module.exports = router;
