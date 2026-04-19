const httpStatus = require('http-status');
const ContratoService = require('../service/ContratoService');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class ContratoController {
    listar = async (req, res, next) => {
        try {
            const contratos = await ContratoService.listar();
            return res.status(httpStatus.OK).json({ status: true, data: contratos });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    buscarPorId = async (req, res, next) => {
        try {
            const contrato = await ContratoService.buscarPorId(req.params.id);
            return res.status(httpStatus.OK).json({ status: true, data: contrato });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const contrato = await ContratoService.criar(req.body);
            return res.status(httpStatus.CREATED).json({ status: true, message: 'Contrato criado com sucesso', data: contrato });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    atualizar = async (req, res, next) => {
        try {
            const contrato = await ContratoService.atualizar(req.params.id, req.body);
            return res.status(httpStatus.OK).json({ status: true, message: 'Contrato atualizado', data: contrato });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    adicionarAditivo = async (req, res, next) => {
        try {
            if (!req.body.numero_aditivo || !req.body.data_assinatura) {
                return next(new ApiError(httpStatus.BAD_REQUEST, 'numero_aditivo e data_assinatura são obrigatórios'));
            }
            const aditivo = await ContratoService.adicionarAditivo(req.params.id, req.body);
            return res.status(httpStatus.CREATED).json({ status: true, message: 'Aditivo registrado', data: aditivo });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    aplicarAditivo = async (req, res, next) => {
        try {
            const aditivo = await ContratoService.aplicarAditivo(req.params.aditivoId);
            return res.status(httpStatus.OK).json({ status: true, message: 'Aditivo aplicado via stored procedure', data: aditivo });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = ContratoController;
