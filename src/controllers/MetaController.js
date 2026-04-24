const httpStatus = require('http-status');
const MetaService = require('../service/MetaService');
const { listarMetas, criarMeta, criarMetaPacote, atualizarMeta } = require('../validator/MetaValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class MetaController {
    listar = async (req, res, next) => {
        try {
            const { error, value } = listarMetas.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const metas = await MetaService.listar(value, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: metas });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const meta = await MetaService.buscarPorId(req.params.id, ossIdFiltro);
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
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const meta = await MetaService.criar(value, ossIdFiltro);
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

    criarPacote = async (req, res, next) => {
        try {
            const { error, value } = criarMetaPacote.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const meta = await MetaService.criarPacote(value, ossIdFiltro);
            return res.status(httpStatus.CREATED).json({
                status: true,
                message: 'Pacote de metas criado com sucesso',
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
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const meta = await MetaService.atualizar(req.params.id, value, ossIdFiltro);
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
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            await MetaService.remover(req.params.id, ossIdFiltro);
            return res.status(httpStatus.NO_CONTENT).send();
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = MetaController;
