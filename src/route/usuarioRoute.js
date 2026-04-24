const express = require('express');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const UsuarioController = require('../controllers/UsuarioController');

const router = express.Router();
const ctrl = new UsuarioController();

router.get('/',    auth(), checkPermission('usuarios', 'view'), ctrl.list);
router.post('/',   auth(), checkPermission('usuarios', 'insert'), ctrl.create);
router.put('/:id', auth(), checkPermission('usuarios', 'update'), ctrl.update);
router.delete('/:id', auth(), checkPermission('usuarios', 'delete'), ctrl.deactivate);

module.exports = router;
