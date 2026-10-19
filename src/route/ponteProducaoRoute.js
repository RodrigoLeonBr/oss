const express = require('express');
const PonteProducaoController = require('../controllers/PonteProducaoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');

const router = express.Router();
const controller = new PonteProducaoController();

// Só leitura — sem auditar (não há escrita)
router.get('/', auth(), checkPermission('relatorios', 'view'), controller.comparar);

module.exports = router;
