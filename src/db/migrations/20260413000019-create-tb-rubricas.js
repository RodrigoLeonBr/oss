'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_rubricas', {
      rubrica_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      contrato_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_contratos', key: 'contrato_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      rubrica_pai_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_rubricas', key: 'rubrica_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      codigo: { type: Sequelize.STRING(20), allowNull: false },
      nome: { type: Sequelize.STRING(200), allowNull: false },
      nivel: {
        type: Sequelize.ENUM('grupo', 'categoria'),
        allowNull: false,
      },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('tb_rubricas', {
      fields: ['contrato_id', 'codigo'],
      type: 'unique',
      name: 'uk_rubrica_contrato_cod',
    });
    await queryInterface.addIndex('tb_rubricas', ['contrato_id'], { name: 'idx_rubrica_contrato' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_rubricas');
  },
};
