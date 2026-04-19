const httpStatus = require('http-status');
const AcompanhamentoService = require('../service/AcompanhamentoService');
const ApiError = require('../helper/ApiError');
const db = require('../models');
const logger = require('../config/logger');

class DescontoController {
    listarDescontosBloco = async (req, res, next) => {
        try {
            const where = {};
            if (req.query.mes) where.mes_referencia = req.query.mes;

            const descontos = await db.desconto_bloco.findAll({
                where,
                include: [
                    { model: db.bloco_producao, as: 'bloco', include: [{ model: db.unidade, as: 'unidade', attributes: ['unidade_id', 'nome', 'sigla'] }] },
                    { model: db.repasse_mensal, as: 'repasse', attributes: ['repasse_id', 'contrato_id', 'mes_referencia'] },
                ],
                order: [['mes_referencia', 'DESC']],
            });

            const total = descontos.reduce((s, d) => s + parseFloat(d.valor_desconto), 0);
            return res.status(httpStatus.OK).json({ status: true, data: { descontos, total: parseFloat(total.toFixed(2)), quantidade: descontos.length } });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    listarDescontosIndicador = async (req, res, next) => {
        try {
            const where = {};
            if (req.query.mes) where.mes_referencia = req.query.mes;

            const descontos = await db.desconto_indicador.findAll({
                where,
                include: [
                    { model: db.indicador, as: 'indicador', attributes: ['indicador_id', 'codigo', 'nome', 'grupo'] },
                    { model: db.repasse_mensal, as: 'repasse', attributes: ['repasse_id', 'contrato_id'] },
                ],
                order: [['mes_referencia', 'DESC']],
            });

            const total = descontos.reduce((s, d) => s + parseFloat(d.valor_desconto), 0);
            return res.status(httpStatus.OK).json({ status: true, data: { descontos, total: parseFloat(total.toFixed(2)), quantidade: descontos.length } });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    auditarDescontoBloco = async (req, res, next) => {
        try {
            const { id } = req.params;
            const auditoraId = req.user.usuario_id || req.user.uuid;

            const desconto = await db.desconto_bloco.findOne({ where: { desc_bloco_id: id } });
            if (!desconto) return next(new ApiError(httpStatus.NOT_FOUND, 'Desconto de bloco não encontrado'));

            await desconto.update({ auditado: true, auditado_por: auditoraId, data_auditoria: new Date() });
            return res.status(httpStatus.OK).json({ status: true, message: 'Desconto auditado', data: await desconto.reload() });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };

    repasse = async (req, res, next) => {
        try {
            const { mes, contrato_id } = req.query;
            if (!mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
                return next(new ApiError(httpStatus.BAD_REQUEST, 'Parâmetro mes obrigatório no formato YYYY-MM-01'));
            }
            const repasse = await AcompanhamentoService.calcularRepasse(mes, contrato_id);
            return res.status(httpStatus.OK).json({ status: true, data: repasse });
        } catch (e) {
            logger.error(e);
            return next(e);
        }
    };
}

module.exports = DescontoController;
