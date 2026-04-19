'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_blocos_producao', {
      bloco_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      unidade_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_unidades', key: 'unidade_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      codigo: { type: Sequelize.STRING(30), allowNull: false },
      nome: { type: Sequelize.STRING(150), allowNull: false },
      descricao: { type: Sequelize.TEXT, allowNull: true },
      valor_mensal_alocado: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      percentual_peso_bloco: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
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

    await queryInterface.addConstraint('tb_blocos_producao', {
      fields: ['unidade_id', 'codigo'],
      type: 'unique',
      name: 'uk_bloco_codigo_unidade',
    });
    await queryInterface.addIndex('tb_blocos_producao', ['unidade_id'], { name: 'idx_blocos_unidade' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_blocos_producao');
  },
};
