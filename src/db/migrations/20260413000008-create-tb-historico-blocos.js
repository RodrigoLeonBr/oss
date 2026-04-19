'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_historico_blocos', {
      hist_bloco_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      bloco_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_blocos_producao', key: 'bloco_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      aditivo_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_aditivos', key: 'aditivo_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      versao: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      vigencia_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      vigencia_fim: { type: Sequelize.DATEONLY, allowNull: true },
      valor_mensal_alocado: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      percentual_peso_bloco: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      motivo_versao: { type: Sequelize.TEXT, allowNull: false },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_historico_blocos', ['bloco_id'], { name: 'idx_hist_bloco' });
    await queryInterface.addIndex('tb_historico_blocos', ['bloco_id', 'vigencia_inicio'], { name: 'idx_hist_bloco_vig' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_historico_blocos');
  },
};
