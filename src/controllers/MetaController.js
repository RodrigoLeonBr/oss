const httpStatus = require('http-status');
const MetaService = require('../service/MetaService');
const { listarMetas, criarMeta, atualizarMeta } = require('../validator/MetaValidator');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class MetaController {
    listar = async (req, res, next) => {
        try {
            const { error, value } = listarMetas.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const metas = await MetaService.listar(value);
            return res.status(httpStatus.OK).json({ status: true, data: metas });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const meta = await MetaService.buscarPorId(req.params.id);
            return res.status(httpStatus.OK).json({ status: true, data: meta });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const { error, value } = criarMeta.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const meta = await MetaService.criar(value);
            return res.status(httpStatus.CREATED).json({
                status: true,
                message: 'Meta criada com sucesso',
                data: meta,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const { error, value } = atualizarMeta.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const meta = await MetaService.atualizar(req.params.id, value);
            return res.status(httpStatus.OK).json({
                status: true,
                message: 'Meta atualizada com sucesso',
                data: meta,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    remover = async (req, res, next) => {
        try {
            await MetaService.remover(req.params.id);
            return res.status(httpStatus.NO_CONTENT).send();
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = MetaController;
