const express = require('express');
const PonteProducaoController = require('../controllers/PonteProducaoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

const router = express.Router();
const controller = new PonteProducaoController();

// Só leitura — sem auditar (não há escrita)
router.get('/', auth(), checkPermission('relatorios', 'view'), controller.comparar);
router.get('/periodo', auth(), checkPermission('relatorios', 'view'), controller.compararPeriodo);

module.exports = router;
