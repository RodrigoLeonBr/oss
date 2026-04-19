const express = require('express');
const IndicadorController = require('../controllers/IndicadorController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new IndicadorController();

router.get('/', auth(), controller.listar);
router.get('/:id', auth(), controller.buscarPorId);

router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_indicadores', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_indicadores', 'UPDATE'),
    controller.atualizar,
);

router.delete(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_indicadores', 'DELETE'),
    controller.desativar,
);

module.exports = router;
