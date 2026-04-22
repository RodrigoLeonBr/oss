const httpStatus = require('http-status');
const IndicadorService = require('../service/IndicadorService');
const { criarIndicador, atualizarIndicador, listarIndicadores } = require('../validator/IndicadorValidator');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class IndicadorController {
    listar = async (req, res, next) => {
        try {
            const { error, value } = listarIndicadores.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const indicadores = await IndicadorService.listar(value);
            return res.status(httpStatus.OK).json({ status: true, data: indicadores });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const indicador = await IndicadorService.buscarPorId(req.params.id);
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
            const indicador = await IndicadorService.criar(value);
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
            const indicador = await IndicadorService.atualizar(req.params.id, value);
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
            await IndicadorService.remover(req.params.id);
            return res.status(httpStatus.NO_CONTENT).send();
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    // Legado — mantido para compatibilidade com o ciclo de acompanhamento mensal
    desativar = async (req, res, next) => {
        try {
            const resultado = await IndicadorService.desativar(req.params.id);
            return res.status(httpStatus.OK).json({ status: true, ...resultado });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = IndicadorController;
