const express = require('express');
const EscalaController = require('../controllers/EscalaController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const c = new EscalaController();
const ver = checkPermission('escalas', 'view');
const dimId = (req, body) => {
    return req.params.id || body?.data?.dimensionamentoId || null;
};

router.get('/setores', auth(), ver, c.setores);
router.get('/grade', auth(), ver, c.grade);
router.get('/profissionais', auth(), ver, c.profissionais);
router.get('/contrato-apresentado', auth(), ver, c.contratoApresentado);

router.get('/dimensionamento', auth(), ver, c.listarDimensionamento);
router.post(
    '/dimensionamento',
    auth(),
    checkPermission('escalas', 'insert'),
    auditar('tb_escala_dimensionamento', 'INSERT', dimId),
    c.criarDimensionamento,
);
router.put(
    '/dimensionamento/:id',
    auth(),
    checkPermission('escalas', 'update'),
    auditar('tb_escala_dimensionamento', 'UPDATE', dimId),
    c.atualizarDimensionamento,
);
router.delete(
    '/dimensionamento/:id',
    auth(),
    checkPermission('escalas', 'delete'),
    auditar('tb_escala_dimensionamento', 'DELETE', dimId),
    c.removerDimensionamento,
);

module.exports = router;
