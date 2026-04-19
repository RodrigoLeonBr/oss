const httpStatus = require('http-status');
const AcompanhamentoService = require('../service/AcompanhamentoService');
const { criarAcompanhamento, listarAcompanhamentos } = require('../validator/AcompanhamentoValidator');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class AcompanhamentoController {
    listar = async (req, res, next) => {
        try {
            const { error, value } = listarAcompanhamentos.validate(req.query);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));

            const where = {};
            if (value.mes) where.mes_referencia = value.mes;
            if (value.status) where.status_cumprimento = value.status;
            if (value.status_aprovacao) where.status_aprovacao = value.status_aprovacao;

            const db = require('../models');
            const include = [{ model: db.indicador, as: 'indicador', include: [{ model: db.unidade, as: 'unidade' }] }];

            if (value.unidade_id) {
                include[0].include[0].where = { unidade_id: value.unidade_id };
                include[0].include[0].required = true;
                include[0].required = true;
            }

            const registros = await db.acompanhamento_mensal.findAll({ where, include });
            return res.status(httpStatus.OK).json({ status: true, data: registros });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    criar = async (req, res, next) => {
        try {
            const { error, value } = criarAcompanhamento.validate(req.body);
            if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));

            const usuarioId = req.user.usuario_id || req.user.uuid;
            const registro = await AcompanhamentoService.criarOuAtualizar(value, usuarioId);

            return res.status(httpStatus.CREATED).json({
                status: true,
                message: 'Acompanhamento registrado com sucesso',
                data: registro,
            });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    aprovar = async (req, res, next) => {
        try {
            const { id } = req.params;
            const auditoraId = req.user.usuario_id || req.user.uuid;
            const registro = await AcompanhamentoService.aprovar(id, auditoraId);
            return res.status(httpStatus.OK).json({ status: true, message: 'Acompanhamento aprovado', data: registro });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    rejeitar = async (req, res, next) => {
        try {
            const { id } = req.params;
            const auditoraId = req.user.usuario_id || req.user.uuid;
            const motivo = req.body.motivo_rejeicao || '';
            const registro = await AcompanhamentoService.rejeitar(id, auditoraId, motivo);
            return res.status(httpStatus.OK).json({ status: true, message: 'Acompanhamento rejeitado', data: registro });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    calcularDescontos = async (req, res, next) => {
        try {
            const { mes, contrato_id } = req.query;
            if (!mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
                return next(new ApiError(httpStatus.BAD_REQUEST, 'Parâmetro mes é obrigatório no formato YYYY-MM-01'));
            }
            const resultado = await AcompanhamentoService.calcularDescontosDoMes(mes, contrato_id);
            return res.status(httpStatus.OK).json({ status: true, data: resultado });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    repasse = async (req, res, next) => {
        try {
            const { mes, contrato_id } = req.query;
            if (!mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
                return next(new ApiError(httpStatus.BAD_REQUEST, 'Parâmetro mes é obrigatório no formato YYYY-MM-01'));
            }
            const repasse = await AcompanhamentoService.calcularRepasse(mes, contrato_id);
            return res.status(httpStatus.OK).json({ status: true, data: repasse });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = AcompanhamentoController;
