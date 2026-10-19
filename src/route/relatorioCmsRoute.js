const express = require('express');
const RelatorioCmsController = require('../controllers/RelatorioCmsController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

const router = express.Router();
const controller = new RelatorioCmsController();

router.get('/cms', auth(), checkPermission('relatorios', 'view'), controller.cms);
router.get('/serie-mensal', auth(), checkPermission('relatorios', 'view'), controller.serie);
router.get('/ultimo-mes', auth(), checkPermission('relatorios', 'view'), controller.ultimoMes);

module.exports = router;
