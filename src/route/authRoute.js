const express = require('express');
const AuthController = require('../controllers/AuthController');
const UserValidator = require('../validator/UserValidator');

const router = express.Router();
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/rbac');
const { auditar } = require('../middlewares/auditoria');

const authController = new AuthController();
const userValidator = new UserValidator();

// Cadastro gateado: só admin (ou perfil com can_insert em 'usuarios'). Antes era público.
router.post(
    '/register',
    auth(),
    checkPermission('usuarios', 'insert'),
    auditar('tb_usuarios', 'INSERT'),
    userValidator.userCreateValidator,
    authController.register,
);
router.post('/email-exists', userValidator.checkEmailValidator, authController.checkEmail);
router.post('/login', userValidator.userLoginValidator, authController.login);
router.post('/refresh-token', authController.refreshTokens);
router.post('/logout', authController.logout);
router.put(
    '/change-password',
    auth(),
    auditar('tb_usuarios', 'UPDATE'),
    userValidator.changePasswordValidator,
    authController.changePassword,
);
router.get('/me/permissions', auth(), authController.mePermissions);

module.exports = router;
