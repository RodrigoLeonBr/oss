'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_oss', {
      oss_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      nome: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      cnpj: {
        type: Sequelize.CHAR(18),
        allowNull: false,
        unique: true,
      },
      tipo_org: {
        type: Sequelize.ENUM('Fundacao', 'Associacao', 'Cooperativa', 'Instituto', 'Outro'),
        allowNull: false,
        defaultValue: 'Instituto',
      },
      email: { type: Sequelize.STRING(200), allowNull: true },
      telefone: { type: Sequelize.STRING(20), allowNull: true },
      endereco_social: { type: Sequelize.TEXT, allowNull: true },
      endereco_adm: { type: Sequelize.TEXT, allowNull: true },
      site: { type: Sequelize.STRING(200), allowNull: true },
      ativa: {
        type: Sequelize.TINYINT(1),
        allowNull: false,
        defaultValue: 1,
      },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      atualizado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_oss');
  },
};
