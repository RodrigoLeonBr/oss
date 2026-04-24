const express = require('express');
const AcompanhamentosController = require('../controllers/AcompanhamentosController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new AcompanhamentosController();

router.get('/',    auth(), checkPermission('entrada_mensal', 'view'), controller.listar);
router.get('/:id', auth(), checkPermission('entrada_mensal', 'view'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    checkPermission('entrada_mensal', 'insert'),
    auditar('tb_acompanhamento_mensal', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    checkPermission('entrada_mensal', 'update'),
    auditar('tb_acompanhamento_mensal', 'UPDATE'),
    controller.atualizar,
);

module.exports = router;
