const express = require('express');
const DescontoController = require('../controllers/DescontoController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new DescontoController();

router.get('/blocos', auth(), controller.listarDescontosBloco);
router.get('/indicadores', auth(), controller.listarDescontosIndicador);

router.get(
    '/repasse',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS, PERFIS.AUDITORA, PERFIS.CMS),
    controller.repasse,
);

router.put(
    '/blocos/:id/auditar',
    auth(),
    authorize(PERFIS.AUDITORA, PERFIS.ADMIN),
    auditar('tb_descontos_bloco', 'APPROVE'),
    controller.auditarDescontoBloco,
);

module.exports = router;
