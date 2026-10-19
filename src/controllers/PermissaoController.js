const httpStatus = require('http-status');
const PermissaoService = require('../service/PermissaoService');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

class PermissaoController {
  constructor() {
    this.permissaoService = new PermissaoService();
  }

  getByPerfil = async (req, res, next) => {
    try {
      const rows = await this.permissaoService.getPermissoesByPerfil(req.params.perfil);
      res.status(httpStatus.OK).json({ status: true, data: rows });
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };

  updateBatch = async (req, res, next) => {
    try {
      if (!Array.isArray(req.body.permissoes)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'permissoes deve ser um array.'));
      }
      await this.permissaoService.upsertPermissoesBatch(req.params.perfil, req.body.permissoes);
      res.status(httpStatus.OK).json({ status: true, message: 'Permissões atualizadas.' });
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };
}

module.exports = PermissaoController;
