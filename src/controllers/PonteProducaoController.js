const httpStatus = require('http-status');
const Joi = require('joi');
const PonteProducaoService = require('../service/PonteProducaoService');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

const ID = Joi.string().pattern(/^[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{4}-[0-9A-Za-z]{12}$/);
const compararSchema = Joi.object({
  unidadeId: ID.required().messages({ 'any.required': 'unidadeId é obrigatório' }),
  competencia: Joi.string().pattern(/^\d{6}$/).required().messages({ 'string.pattern.base': 'competencia deve ser AAAAMM' }),
});

const periodoSchema = Joi.object({
  mes: Joi.string().pattern(/^\d{4}-\d{2}-01$/).required()
    .messages({ 'string.pattern.base': 'mes deve estar no formato YYYY-MM-01' }),
  periodo: Joi.string().valid('mes', 'acumulado', 'trimestre', 'quadrimestre', 'ano').default('mes'),
  escopo: Joi.string().valid('todos', 'contrato', 'unidade').default('todos'),
  contrato_id: Joi.when('escopo', { is: 'contrato', then: ID.required(), otherwise: ID.optional() }),
  unidade_id: Joi.when('escopo', { is: 'unidade', then: ID.required(), otherwise: ID.optional() }),
});

class PonteProducaoController {
  comparar = async (req, res, next) => {
    try {
      const { error, value } = compararSchema.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await PonteProducaoService.comparar(value, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };

  compararPeriodo = async (req, res, next) => {
    try {
      const { error, value } = periodoSchema.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await PonteProducaoService.compararPeriodo({
        mes: value.mes,
        periodo: value.periodo,
        escopo: value.escopo,
        contratoId: value.contrato_id,
        unidadeId: value.unidade_id,
      }, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };
}

module.exports = PonteProducaoController;
