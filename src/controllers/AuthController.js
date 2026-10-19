const httpStatus = require('http-status');
const AuthService = require('../service/AuthService');
const TokenService = require('../service/TokenService');
const UserService = require('../service/UserService');
const logger = require('../config/logger');
const ApiError = require('../helper/ApiError');
const { tokenTypes } = require('../config/tokens');

class AuthController {
    constructor() {
        this.userService = new UserService();
        this.tokenService = new TokenService();
        this.authService = new AuthService();
    }

    register = async (req, res, next) => {
        try {
            const user = await this.userService.createUser(req.body);
            let tokens = {};
            const { status } = user.response;
            if (user.response.status) {
                tokens = await this.tokenService.generateAuthTokens(user.response.data);
            }

            const { message, data } = user.response;
            res.status(user.statusCode).send({ status, message, data, tokens });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    checkEmail = async (req, res, next) => {
        try {
            const isExists = await this.userService.isEmailExists(req.body.email.toLowerCase());
            res.status(isExists.statusCode).send(isExists.response);
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    login = async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const user = await this.authService.loginWithEmailPassword(
                email.toLowerCase(),
                password,
            );
            const { message } = user.response;
            const { data } = user.response;
            const { status } = user.response;
            const code = user.statusCode;
            let tokens = {};
            let permissions = [];
            if (user.response.status) {
                tokens = await this.tokenService.generateAuthTokens(data);
                const models = require('../models');
                const rows = await models.permissaoPerfil.findAll({
                    where: { perfil: data.perfil },
                    order: [['modulo', 'ASC']],
                });
                permissions = rows.map((r) => r.get({ plain: true }));
            }
            res.status(user.statusCode).send({ status, code, message, data, tokens, permissions });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    logout = async (req, res) => {
        await this.authService.logout(req, res);
        res.status(httpStatus.NO_CONTENT).send();
    };

    refreshTokens = async (req, res, next) => {
        try {
            const refreshTokenDoc = await this.tokenService.verifyToken(
                req.body.refresh_token,
                tokenTypes.REFRESH,
            );
            const models = require('../models');
            const user = await models.usuario.findOne({
                where: { usuario_id: refreshTokenDoc.user_uuid, ativo: 1 },
            });
            if (user == null) {
                return next(new ApiError(httpStatus.UNAUTHORIZED, 'Usuário não encontrado'));
            }
            await this.tokenService.removeTokenById(refreshTokenDoc.id);
            const tokens = await this.tokenService.generateAuthTokens(user);
            res.send(tokens);
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    changePassword = async (req, res, next) => {
        try {
            const responseData = await this.userService.changePassword(req.body, req.user.uuid);
            res.status(responseData.statusCode).send(responseData.response);
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    mePermissions = async (req, res, next) => {
        try {
            const models = require('../models');
            const perfil = req.user.perfil || req.user.dataValues?.perfil;
            const rows = await models.permissaoPerfil.findAll({
                where: { perfil },
                order: [['modulo', 'ASC']],
            });
            res.status(httpStatus.OK).json({ status: true, data: rows });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = AuthController;
