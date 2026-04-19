const express = require('express');
const ContratoController = require('../controllers/ContratoController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new ContratoController();

router.get('/', auth(), controller.listar);
router.get('/:id', auth(), auditarVisualizacao('tb_contratos'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_contratos', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_contratos', 'UPDATE'),
    controller.atualizar,
);

router.post(
    '/:id/aditivos',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_aditivos', 'INSERT'),
    controller.adicionarAditivo,
);

router.post(
    '/:id/aditivos/:aditivoId/aplicar',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_aditivos', 'UPDATE'),
    controller.aplicarAditivo,
);

module.exports = router;
