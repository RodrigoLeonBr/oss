const httpStatus = require('http-status');
const AcompanhamentosService = require('../service/AcompanhamentosService');
const { listarAcompanhamentos, criarAcompanhamento, atualizarAcompanhamento } = require('../validator/AcompanhamentosValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class AcompanhamentosController {
    listar = async (req, res, next) => {
        try {
            const { error, value } = listarAcompanhamentos.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const data = await AcompanhamentosService.listar(value, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const data = await AcompanhamentosService.buscarPorId(req.params.id, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const { error, value } = criarAcompanhamento.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const data = await AcompanhamentosService.criar(value, ossIdFiltro);
            return res.status(httpStatus.CREATED).json({ status: true, message: 'Acompanhamento registrado com sucesso', data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const { error, value } = atualizarAcompanhamento.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const data = await AcompanhamentosService.atualizar(req.params.id, value, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, message: 'Acompanhamento atualizado com sucesso', data });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = AcompanhamentosController;
