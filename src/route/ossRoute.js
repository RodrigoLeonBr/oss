const express = require('express');
const OssController = require('../controllers/OssController');
const auth = require('../middlewares/auth');
const { authorize, PERFIS } = require('../middlewares/rbac');
const { auditar, auditarVisualizacao } = require('../middlewares/auditoria');

const router = express.Router();
const controller = new OssController();

router.get('/', auth(), controller.listar);
router.get('/:id', auth(), auditarVisualizacao('tb_oss'), controller.buscarPorId);

router.post(
    '/',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_oss', 'INSERT'),
    controller.criar,
);

router.put(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN, PERFIS.GESTOR_SMS),
    auditar('tb_oss', 'UPDATE'),
    controller.atualizar,
);

router.delete(
    '/:id',
    auth(),
    authorize(PERFIS.ADMIN),
    auditar('tb_oss', 'DELETE'),
    controller.remover,
);

module.exports = router;
