const httpStatus = require('http-status');
const UsuarioService = require('../service/UsuarioService');
const logger = require('../config/logger');

const getCallerPerfil = (user) => user.perfil || user.dataValues?.perfil;

class UsuarioController {
  constructor() {
    this.usuarioService = new UsuarioService();
  }

  list = async (req, res, next) => {
    try {
      const rows = await this.usuarioService.listUsuarios(getCallerPerfil(req.user));
      res.status(httpStatus.OK).json({ status: true, data: rows });
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };

  create = async (req, res, next) => {
    try {
      const result = await this.usuarioService.createUsuario(req.body, getCallerPerfil(req.user));
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };

  update = async (req, res, next) => {
    try {
      const result = await this.usuarioService.updateUsuario(
        req.params.id, req.body, getCallerPerfil(req.user),
      );
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };

  deactivate = async (req, res, next) => {
    try {
      const result = await this.usuarioService.deactivateUsuario(req.params.id);
      res.status(result.statusCode).json(result.response);
    } catch (e) {
      logger.error(e);
      return next(e);
    }
  };
}

module.exports = UsuarioController;
