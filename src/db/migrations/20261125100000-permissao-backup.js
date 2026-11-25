'use strict';

const { randomUUID } = require('crypto');

// Módulo 'backup' (dump/restauração do banco): só admin tem acesso. Demais perfis ficam com zero.
const PERFIS = [
  'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
  'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tb_permissoes_perfil', PERFIS.map((perfil) => ({
      perm_id: randomUUID(),
      perfil,
      modulo: 'backup',
      can_view: perfil === 'admin' ? 1 : 0,
      can_insert: perfil === 'admin' ? 1 : 0,
      can_update: perfil === 'admin' ? 1 : 0,
      can_delete: perfil === 'admin' ? 1 : 0,
      escopo: 'global',
    })));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_permissoes_perfil', { modulo: 'backup' });
  },
};
