'use strict';

// Escrita no módulo 'relatorios' habilita o CRUD do Mapa de Produção (de-para SIA/SIH).
// Só as rotas POST/PUT/DELETE de /mapa-producao usam relatorios insert/update/delete.
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkUpdate('tb_permissoes_perfil',
      { can_insert: 1, can_update: 1, can_delete: 1 },
      { perfil: 'admin', modulo: 'relatorios' });
    await queryInterface.bulkUpdate('tb_permissoes_perfil',
      { can_insert: 1, can_update: 1, can_delete: 0 },
      { perfil: 'gestor_sms', modulo: 'relatorios' });
  },

  async down(queryInterface) {
    await queryInterface.bulkUpdate('tb_permissoes_perfil',
      { can_insert: 0, can_update: 0, can_delete: 0 },
      { perfil: { [require('sequelize').Op.in]: ['admin', 'gestor_sms'] }, modulo: 'relatorios' });
  },
};
