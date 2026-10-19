const httpStatus = require('http-status');
const RelatorioCmsService = require('../service/RelatorioCmsService');
const { gerarRelatorioCms, serieRelatorioCms } = require('../validator/RelatorioCmsValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class RelatorioCmsController {
  cms = async (req, res, next) => {
    try {
      const { error, value } = gerarRelatorioCms.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));

      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await RelatorioCmsService.gerar({
        mes: value.mes,
        periodo: value.periodo,
        escopo: value.escopo,
        contratoId: value.contrato_id,
        unidadeId: value.unidade_id,
      }, ossIdFiltro);

      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };

  ultimoMes = async (req, res, next) => {
    try {
      const mes = await RelatorioCmsService.ultimoMesComDados();
      return res.status(httpStatus.OK).json({ status: true, data: { mes } });
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };

  serie = async (req, res, next) => {
    try {
      const { error, value } = serieRelatorioCms.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));

      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await RelatorioCmsService.serieMensal({
        mes: value.mes,
        meses: value.meses,
        escopo: value.escopo,
        contratoId: value.contrato_id,
        unidadeId: value.unidade_id,
      }, ossIdFiltro);

      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };
}

module.exports = RelatorioCmsController;
