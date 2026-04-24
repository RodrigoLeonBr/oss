const httpStatus = require('http-status');
const UnidadeService = require('../service/UnidadeService');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class UnidadeController {
    listar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const filtros = {
                contratoId: req.query.contratoId,
                ativa: req.query.ativa !== undefined ? req.query.ativa !== 'false' : undefined,
            };
            const lista = await UnidadeService.listar(filtros, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: lista });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const unidade = await UnidadeService.buscarPorId(req.params.id, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: unidade });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const unidade = await UnidadeService.criar(req.body, ossIdFiltro);
            return res.status(httpStatus.CREATED).json({
                status: true,
                message: 'Unidade criada com sucesso',
                data: unidade,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const unidade = await UnidadeService.atualizar(req.params.id, req.body, ossIdFiltro);
            return res.status(httpStatus.OK).json({
                status: true,
                message: 'Unidade atualizada com sucesso',
                data: unidade,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    remover = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            await UnidadeService.remover(req.params.id, ossIdFiltro);
            return res.status(httpStatus.NO_CONTENT).send();
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = UnidadeController;
