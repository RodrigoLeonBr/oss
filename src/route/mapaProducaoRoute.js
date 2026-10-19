const express = require('express');
const MapaProducaoController = require('../controllers/MapaProducaoController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new MapaProducaoController();

router.get('/', auth(), checkPermission('relatorios', 'view'), controller.listar);

router.post('/', auth(), checkPermission('relatorios', 'insert'),
  auditar('tb_mapa_producao', 'INSERT'), controller.criar);

router.put('/:id', auth(), checkPermission('relatorios', 'update'),
  auditar('tb_mapa_producao', 'UPDATE'), controller.atualizar);

router.delete('/:id', auth(), checkPermission('relatorios', 'delete'),
  auditar('tb_mapa_producao', 'DELETE'), controller.remover);

module.exports = router;
