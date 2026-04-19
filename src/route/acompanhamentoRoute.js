const express = require('express');
const AcompanhamentoController = require('../controllers/AcompanhamentoController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new AcompanhamentoController();

router.get('/', auth(), controller.listar);

router.post(
    '/',
    auth(),
    authorize(PERFIS.GESTOR_SMS, PERFIS.ADMIN, PERFIS.CONTRATADA_SCMC, PERFIS.CONTRATADA_INDSH),
    auditar('tb_acompanhamento_mensal', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id/aprovar',
    auth(),
    authorize(PERFIS.AUDITORA, PERFIS.ADMIN),
    auditar('tb_acompanhamento_mensal', 'APPROVE'),
    controller.aprovar,
);

router.put(
    '/:id/rejeitar',
    auth(),
    authorize(PERFIS.AUDITORA, PERFIS.ADMIN),
    auditar('tb_acompanhamento_mensal', 'REJECT'),
    controller.rejeitar,
);

router.post(
    '/calcular-descontos',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    controller.calcularDescontos,
);

router.get(
    '/repasse',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS, PERFIS.AUDITORA, PERFIS.CMS),
    controller.repasse,
);

module.exports = router;
