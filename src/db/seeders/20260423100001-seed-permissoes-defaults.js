'use strict';
const { randomUUID } = require('crypto');

const DEFAULTS = [
  { perfil: 'admin', modulo: 'dashboard',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'admin', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'aprovacao',     can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'relatorios',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'admin', modulo: 'perfil_oss',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'admin', modulo: 'oss',           can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'contratos',     can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'unidades',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'indicadores',   can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'metas',         can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'usuarios',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },
  { perfil: 'admin', modulo: 'permissoes',    can_view: 1, can_insert: 1, can_update: 1, can_delete: 1, escopo: 'global' },

  { perfil: 'gestor_sms', modulo: 'dashboard',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'aprovacao',     can_view: 0, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'relatorios',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'perfil_oss',    can_view: 0, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'oss',           can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'contratos',     can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'unidades',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'indicadores',   can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'metas',         can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'usuarios',      can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'gestor_sms', modulo: 'permissoes',    can_view: 0, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  { perfil: 'auditora', modulo: 'dashboard',   can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'auditora', modulo: 'aprovacao',   can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'global' },
  { perfil: 'auditora', modulo: 'relatorios',  can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'auditora', modulo: 'indicadores', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  { perfil: 'conselheiro_cms', modulo: 'relatorios', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  { perfil: 'central_regulacao', modulo: 'dashboard',  can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'central_regulacao', modulo: 'relatorios', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  { perfil: 'visualizador', modulo: 'dashboard',  can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },
  { perfil: 'visualizador', modulo: 'relatorios', can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'global' },

  { perfil: 'contratada_scmc', modulo: 'perfil_oss',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'contratos',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'unidades',      can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'indicadores',   can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'metas',         can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_scmc', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'proprio' },

  { perfil: 'contratada_indsh', modulo: 'perfil_oss',    can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'contratos',     can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'unidades',      can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'indicadores',   can_view: 1, can_insert: 0, can_update: 1, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'metas',         can_view: 1, can_insert: 0, can_update: 0, can_delete: 0, escopo: 'proprio' },
  { perfil: 'contratada_indsh', modulo: 'entrada_mensal',can_view: 1, can_insert: 1, can_update: 1, can_delete: 0, escopo: 'proprio' },
];

module.exports = {
  async up(queryInterface) {
    const rows = DEFAULTS.map(r => ({ perm_id: randomUUID(), ...r }));
    await queryInterface.bulkInsert('tb_permissoes_perfil', rows, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_permissoes_perfil', null, {});
  },
};
