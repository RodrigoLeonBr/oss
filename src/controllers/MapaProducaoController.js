const httpStatus = require('http-status');
const MapaProducaoService = require('../service/MapaProducaoService');
const { criarMapa, atualizarMapa, listarMapa } = require('../validator/MapaProducaoValidator');
const ApiError = require('../helper/ApiError');
const { getOssIdSeEscopoProprio } = require('../helper/ossScopeHelper');
const logger = require('../config/logger');

class MapaProducaoController {
  listar = async (req, res, next) => {
    try {
      const { error, value } = listarMapa.validate(req.query);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await MapaProducaoService.listar(value, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, data });
    } catch (e) { logger.error(e); return next(e); }
  };

  criar = async (req, res, next) => {
    try {
      const { error, value } = criarMapa.validate(req.body);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await MapaProducaoService.criar(value, ossIdFiltro);
      return res.status(httpStatus.CREATED).json({ status: true, message: 'Mapeamento criado', data });
    } catch (e) { logger.error(e); return next(e); }
  };

  atualizar = async (req, res, next) => {
    try {
      const { error, value } = atualizarMapa.validate(req.body);
      if (error) return next(new ApiError(httpStatus.BAD_REQUEST, error.details[0].message));
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      const data = await MapaProducaoService.atualizar(req.params.id, value, ossIdFiltro);
      return res.status(httpStatus.OK).json({ status: true, message: 'Mapeamento atualizado', data });
    } catch (e) { logger.error(e); return next(e); }
  };

  remover = async (req, res, next) => {
    try {
      const ossIdFiltro = getOssIdSeEscopoProprio(req);
      await MapaProducaoService.remover(req.params.id, ossIdFiltro);
      return res.status(httpStatus.NO_CONTENT).send();
    } catch (e) { logger.error(e); return next(e); }
  };
}

module.exports = MapaProducaoController;
