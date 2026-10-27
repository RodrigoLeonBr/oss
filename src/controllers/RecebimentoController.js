const httpStatus = require('http-status');
const RecebimentoService = require('../service/RecebimentoService');
const { consultarRecebimento, criarNota, validarNota } = require('../validator/RecebimentoValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

const validar = (schema, dados) => {
    const { error, value } = schema.validate(dados);
    if (error) throw new ApiError(httpStatus.BAD_REQUEST, error.details[0].message);
    return value;
};

class RecebimentoController {
    consultar = async (req, res, next) => {
        try {
            const { contratoId, mes } = validar(consultarRecebimento, { contratoId: req.params.contratoId, mes: req.query.mes });
            const data = await RecebimentoService.calcularRecebimento(contratoId, mes, getOssIdSeEscopoProprio(req));
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criarNota = async (req, res, next) => {
        try {
            const dados = validar(criarNota, req.body);
            const usuarioId = req.user.usuario_id || req.user.uuid;
            const data = await RecebimentoService.criarNota(req.params.acompId, dados, usuarioId, getOssIdSeEscopoProprio(req));
            return res.status(httpStatus.CREATED).json({ status: true, data, message: 'Justificativa registrada' });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    validarNota = async (req, res, next) => {
        try {
            const dados = validar(validarNota, req.body);
            const usuarioId = req.user.usuario_id || req.user.uuid;
            const data = await RecebimentoService.validarNota(req.params.notaId, dados, usuarioId, getOssIdSeEscopoProprio(req));
            return res.status(httpStatus.OK).json({ status: true, data, message: 'Justificativa avaliada' });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = RecebimentoController;
