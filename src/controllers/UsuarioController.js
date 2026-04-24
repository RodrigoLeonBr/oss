const httpStatus = require('http-status');
const UsuarioService = require('../service/UsuarioService');
const logger = require('../config/logger');

const getCallerPerfil = (user) => user.perfil || user.dataValues?.perfil;

class UsuarioController {
  constructor() {
    this.usuarioService = new UsuarioService();
  }

  list = async (req, res) => {
    try {
      const rows = await this.usuarioService.listUsuarios(getCallerPerfil(req.user));
      res.status(httpStatus.OK).json({ status: true, data: rows });
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  create = async (req, res) => {
    try {
      const result = await this.usuarioService.createUsuario(req.body, getCallerPerfil(req.user));
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  update = async (req, res) => {
    try {
      const result = await this.usuarioService.updateUsuario(
        req.params.id, req.body, getCallerPerfil(req.user),
      );
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };

  deactivate = async (req, res) => {
    try {
      const result = await this.usuarioService.deactivateUsuario(req.params.id);
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: e.message });
    }
  };
}

module.exports = UsuarioController;
