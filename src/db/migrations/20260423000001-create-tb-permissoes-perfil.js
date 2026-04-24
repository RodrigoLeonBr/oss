'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_permissoes_perfil', {
      perm_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      perfil: {
        type: Sequelize.ENUM(
          'admin', 'gestor_sms', 'auditora', 'conselheiro_cms',
          'contratada_scmc', 'contratada_indsh', 'central_regulacao', 'visualizador'
        ),
        allowNull: false,
      },
      modulo: { type: Sequelize.STRING(50), allowNull: false },
      can_view:   { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      can_insert: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      can_update: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      can_delete: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      escopo: {
        type: Sequelize.ENUM('global', 'proprio'),
        allowNull: false,
        defaultValue: 'global',
      },
    });

    await queryInterface.addConstraint('tb_permissoes_perfil', {
      fields: ['perfil', 'modulo'],
      type: 'unique',
      name: 'uq_perfil_modulo',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_permissoes_perfil');
  },
};
