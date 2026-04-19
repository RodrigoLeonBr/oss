const express = require('express');
const MetaController = require('../controllers/MetaController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new MetaController();

router.get('/', auth(), controller.listar);

router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_metas', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_metas', 'UPDATE'),
    controller.atualizar,
);

module.exports = router;
