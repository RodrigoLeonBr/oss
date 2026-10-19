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
}

module.exports = PonteProducaoController;
