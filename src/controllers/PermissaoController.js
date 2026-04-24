const httpStatus = require('http-status');
const PermissaoService = require('../service/PermissaoService');
const logger = require('../config/logger');

class PermissaoController {
  constructor() {
    this.permissaoService = new PermissaoService();
  }

  getByPerfil = async (req, res) => {
    try {
      const rows = await this.permissaoService.getPermissoesByPerfil(req.params.perfil);
      res.status(httpStatus.OK).json({ status: true, data: rows });
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  updateBatch = async (req, res) => {
    try {
      if (!Array.isArray(req.body.permissoes)) {
        return res.status(httpStatus.BAD_REQUEST).json({ status: false, message: 'permissoes deve ser um array.' });
      }
      await this.permissaoService.upsertPermissoesBatch(req.params.perfil, req.body.permissoes);
      res.status(httpStatus.OK).json({ status: true, message: 'Permissões atualizadas.' });
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };
}

module.exports = PermissaoController;
