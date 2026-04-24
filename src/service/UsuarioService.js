const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');
const { Op } = require('sequelize');
const models = require('../models');
const responseHandler = require('../helper/responseHandler');
const logger = require('../config/logger');

const PERFIS_PRIVILEGIADOS = ['admin', 'gestor_sms'];
const PERFIS_CONTRATADA    = ['contratada_scmc', 'contratada_indsh'];

class UsuarioService {
  createUsuario = async (body, callerPerfil) => {
    try {
      if (callerPerfil === 'gestor_sms' && PERFIS_PRIVILEGIADOS.includes(body.perfil)) {
        return responseHandler.returnError(httpStatus.FORBIDDEN, 'gestor_sms não pode criar perfis privilegiados.');
      }
      if (PERFIS_CONTRATADA.includes(body.perfil) && !body.oss_id) {
        return responseHandler.returnError(httpStatus.BAD_REQUEST, 'Perfil contratada requer oss_id.');
      }
      const exists = await models.usuario.findOne({ where: { email: body.email.toLowerCase() } });
      if (exists) {
        return responseHandler.returnError(httpStatus.CONFLICT, 'E-mail já cadastrado.');
      }
      const senha_hash = bcrypt.hashSync(body.senha, 10);
      const usuario = await models.usuario.create({
        nome:      body.nome,
        email:     body.email.toLowerCase(),
        cpf:       body.cpf || null,
        telefone:  body.telefone || null,
        perfil:    body.perfil,
        oss_id:    body.oss_id || null,
        senha_hash,
      });
      const data = usuario.toJSON();
      delete data.senha_hash;
      delete data.token_2fa;
      return responseHandler.returnSuccess(httpStatus.CREATED, 'Usuário criado com sucesso.', data);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao criar usuário.');
    }
  };

  listUsuarios = async (callerPerfil) => {
    const where = {};
    if (callerPerfil === 'gestor_sms') {
      where.perfil = { [Op.notIn]: PERFIS_PRIVILEGIADOS };
    }
    const rows = await models.usuario.findAll({
      where,
      include: [{ model: models.oss, as: 'organizacao', attributes: ['oss_id', 'nome'] }],
      order: [['nome', 'ASC']],
    });
    return rows.map((u) => {
      const d = u.toJSON();
      delete d.senha_hash;
      delete d.token_2fa;
      return d;
    });
  };

  getUsuarioById = async (id) => {
    const u = await models.usuario.findOne({ where: { usuario_id: id } });
    if (!u) return null;
    const d = u.toJSON();
    delete d.senha_hash;
    delete d.token_2fa;
    return d;
  };

  updateUsuario = async (id, body, callerPerfil) => {
    try {
      const usuario = await models.usuario.findOne({ where: { usuario_id: id } });
      if (!usuario) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Usuário não encontrado.');
      const perfilAlvo = usuario.perfil || usuario.dataValues?.perfil;
      if (callerPerfil === 'gestor_sms' && PERFIS_PRIVILEGIADOS.includes(perfilAlvo)) {
        return responseHandler.returnError(httpStatus.FORBIDDEN, 'gestor_sms não pode alterar perfis privilegiados.');
      }
      if (callerPerfil === 'gestor_sms' && body.perfil && PERFIS_PRIVILEGIADOS.includes(body.perfil)) {
        return responseHandler.returnError(httpStatus.FORBIDDEN, 'gestor_sms não pode atribuir perfis privilegiados.');
      }
      const updates = {};
      if (body.nome)                updates.nome      = body.nome;
      if (body.email)               updates.email     = body.email.toLowerCase();
      if (body.telefone !== undefined) updates.telefone = body.telefone;
      if (body.perfil)              updates.perfil    = body.perfil;
      if (body.ativo !== undefined) updates.ativo     = body.ativo ? 1 : 0;
      if (body.oss_id !== undefined) updates.oss_id   = body.oss_id || null;
      if (body.senha)               updates.senha_hash = bcrypt.hashSync(body.senha, 10);
      await usuario.update(updates);
      const data = usuario.toJSON();
      delete data.senha_hash;
      delete data.token_2fa;
      return responseHandler.returnSuccess(httpStatus.OK, 'Usuário atualizado.', data);
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao atualizar usuário.');
    }
  };

  deactivateUsuario = async (id) => {
    try {
      const usuario = await models.usuario.findOne({ where: { usuario_id: id } });
      if (!usuario) return responseHandler.returnError(httpStatus.NOT_FOUND, 'Usuário não encontrado.');
      await usuario.update({ ativo: 0 });
      return responseHandler.returnSuccess(httpStatus.OK, 'Usuário desativado.');
    } catch (e) {
      logger.error(e);
      return responseHandler.returnError(httpStatus.INTERNAL_SERVER_ERROR, 'Erro ao desativar usuário.');
    }
  };
}

module.exports = UsuarioService;
