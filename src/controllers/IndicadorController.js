const httpStatus = require('http-status');
const IndicadorService = require('../service/IndicadorService');
const { criarIndicador, atualizarIndicador, listarIndicadores } = require('../validator/IndicadorValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class IndicadorController {
    listar = async (req, res, next) => {
        try {
            const { error, value } = listarIndicadores.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const indicadores = await IndicadorService.listar(value, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: indicadores });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const indicador = await IndicadorService.buscarPorId(req.params.id, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: indicador });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const { error, value } = criarIndicador.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const indicador = await IndicadorService.criar(value, ossIdFiltro);
            return res.status(httpStatus.CREATED).json({
                status: true,
                message: 'Indicador criado com sucesso',
                data: indicador,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const { error, value } = atualizarIndicador.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const indicador = await IndicadorService.atualizar(req.params.id, value, ossIdFiltro);
            return res.status(httpStatus.OK).json({
                status: true,
                message: 'Indicador atualizado com sucesso',
                data: indicador,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    remover = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            await IndicadorService.remover(req.params.id, ossIdFiltro);
            return res.status(httpStatus.NO_CONTENT).send();
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    // Legado — mantido para compatibilidade com o ciclo de acompanhamento mensal
    desativar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const resultado = await IndicadorService.desativar(req.params.id, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, ...resultado });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = IndicadorController;
