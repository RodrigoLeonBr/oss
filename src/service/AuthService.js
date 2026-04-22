const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');
const models = require('../models');

const Usuario = models.usuario;

class AuthService {
    loginWithEmailPassword = async (email, password) => {
        try {
            const user = await Usuario.findOne({ where: { email, ativo: 1 } });

            if (!user) {
                return responseHandler.returnError(
                    httpStatus.BAD_REQUEST,
                    'E-mail não cadastrado ou inativo.',
                );
            }

            const isPasswordValid = await bcrypt.compare(password, user.senha_hash);
            if (!isPasswordValid) {
                return responseHandler.returnError(
                    httpStatus.BAD_REQUEST,
                    'Senha incorreta.',
                );
            }

            const data = user.toJSON();
            delete data.senha_hash;
            delete data.token_2fa;

            return responseHandler.returnSuccess(httpStatus.OK, 'Login Successful', data);
        } catch (e) {
            logger.error(e);
            return responseHandler.returnError(httpStatus.BAD_GATEWAY, 'Erro interno no login.');
        }
    };

    logout = async (refreshToken) => {
        return responseHandler.returnSuccess(httpStatus.OK, 'Logout realizado.');
    };
}

module.exports = AuthService;
