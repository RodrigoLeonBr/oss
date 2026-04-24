const models = require('../models');

const VALID_PERFIS = [
  'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
  'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador',
];

class PermissaoService {
  getPermissoesByPerfil = async (perfil) => {
    return models.permissaoPerfil.findAll({
      where: { perfil },
      order: [['modulo', 'ASC']],
    });
  };

  upsertPermissoesBatch = async (perfil, permissoes) => {
    if (!VALID_PERFIS.includes(perfil)) {
      throw new Error(`Perfil inválido: ${perfil}`);
    }
    const ops = permissoes.map(async (p) => {
      const existing = await models.permissaoPerfil.findOne({
        where: { perfil, modulo: p.modulo },
      });
      if (existing) {
        return existing.update({
          can_view:   p.can_view   ? 1 : 0,
          can_insert: p.can_insert ? 1 : 0,
          can_update: p.can_update ? 1 : 0,
          can_delete: p.can_delete ? 1 : 0,
          escopo:     p.escopo || 'global',
        });
      }
      return models.permissaoPerfil.create({
        perfil,
        modulo:     p.modulo,
        can_view:   p.can_view   ? 1 : 0,
        can_insert: p.can_insert ? 1 : 0,
        can_update: p.can_update ? 1 : 0,
        can_delete: p.can_delete ? 1 : 0,
        escopo:     p.escopo || 'global',
      });
    });
    return Promise.all(ops);
  };
}

module.exports = PermissaoService;
