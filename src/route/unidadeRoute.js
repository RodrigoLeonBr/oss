const express = require('express');
const UnidadeController = require('../controllers/UnidadeController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new UnidadeController();

router.get('/', auth(), controller.listar);
router.get('/:id', auth(), auditarVisualizacao('tb_unidades'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_unidades', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_unidades', 'UPDATE'),
    controller.atualizar,
);

router.delete(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_unidades', 'DELETE'),
    controller.remover,
);

module.exports = router;
