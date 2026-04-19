const httpStatus = require('http-status');
const ApiError = require('../helper/ApiError');

const PERFIS = {
    ADMIN: 'admin',
    GESTOR_SMS: 'gestor_sms',
    AUDITORA: 'auditora',
    CMS: 'conselheiro_cms',
    CONTRATADA_SCMC: 'contratada_scmc',
    CONTRATADA_INDSH: 'contratada_indsh',
    CENTRAL_REGULACAO: 'central_regulacao',
    VISUALIZADOR: 'visualizador',
};

const PERFIS_CONTRATADA = [PERFIS.CONTRATADA_SCMC, PERFIS.CONTRATADA_INDSH];

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(httpStatus.UNAUTHORIZED, 'Autenticação necessária'));
        }

        const perfilUsuario = req.user.perfil || req.user.dataValues?.perfil;

        if (!roles.includes(perfilUsuario)) {
            return next(
                new ApiError(
                    httpStatus.FORBIDDEN,
                    `Acesso negado. Perfil '${perfilUsuario}' não autorizado para esta operação.`,
                ),
            );
        }

        return next();
    };
};

const verificarAcessoUnidade = (req, res, next) => {
    const { user } = req;
    const perfilUsuario = user.perfil || user.dataValues?.perfil;
    const ossIdUsuario = user.oss_id || user.dataValues?.oss_id;
    const unidadeIdRequisicao = req.params.unidade_id || req.query.unidade_id;

    if (PERFIS_CONTRATADA.includes(perfilUsuario) && unidadeIdRequisicao) {
        if (!ossIdUsuario) {
            return next(new ApiError(httpStatus.FORBIDDEN, 'Perfil contratada sem OSS vinculada.'));
        }
    }

    return next();
};

module.exports = { authorize, verificarAcessoUnidade, PERFIS, PERFIS_CONTRATADA };
