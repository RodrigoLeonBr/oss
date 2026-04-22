const express = require('express');
const AcompanhamentosController = require('../controllers/AcompanhamentosController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new AcompanhamentosController();

router.get('/',    auth(), controller.listar);
router.get('/:id', auth(), controller.buscarPorId);

router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_acompanhamento_mensal', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_acompanhamento_mensal', 'UPDATE'),
    controller.atualizar,
);

module.exports = router;
