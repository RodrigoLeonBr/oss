const httpStatus = require('http-status');
const OssService = require('../service/OssService');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class OssController {
    listar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const lista = await OssService.listar(ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: lista });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const oss = await OssService.buscarPorId(req.params.id, ossIdFiltro);
            return res.status(httpStatus.OK).json({ status: true, data: oss });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const oss = await OssService.criar(req.body, ossIdFiltro);
            return res.status(httpStatus.CREATED).json({
                status: true,
                message: 'Organização criada com sucesso',
                data: oss,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            const oss = await OssService.atualizar(req.params.id, req.body, ossIdFiltro);
            return res.status(httpStatus.OK).json({
                status: true,
                message: 'Organização atualizada com sucesso',
                data: oss,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    remover = async (req, res, next) => {
        try {
            const ossIdFiltro = getOssIdSeEscopoProprio(req);
            await OssService.remover(req.params.id, ossIdFiltro);
            return res.status(httpStatus.NO_CONTENT).send();
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = OssController;
