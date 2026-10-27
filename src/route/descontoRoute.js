const express = require('express');
const DescontoController = require('../controllers/DescontoController');
const RecebimentoController = require('../controllers/RecebimentoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new DescontoController();
const recebimento = new RecebimentoController();

router.get('/blocos', auth(), checkPermission('entrada_mensal', 'view'), controller.listarDescontosBloco);
router.get('/indicadores', auth(), checkPermission('indicadores', 'view'), controller.listarDescontosIndicador);

router.get(
    '/repasse',
    auth(),
    checkPermission('relatorios', 'view'),
    controller.repasse,
);

// Percentual de recebimento (fixa ← grupos quant, variável ← nota qual), apurado × após comissão
router.get('/recebimento/:contratoId', auth(), checkPermission('entrada_mensal', 'view'), recebimento.consultar);

router.put(
    '/blocos/:id/auditar',
    auth(),
    checkPermission('aprovacao', 'update'),
    auditar('tb_descontos_bloco', 'APPROVE'),
    controller.auditarDescontoBloco,
);

module.exports = router;
