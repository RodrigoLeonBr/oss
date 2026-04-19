'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_historico_contrato', {
      historico_id: {
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
      valor_mensal_base: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      perc_fixo: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      perc_variavel: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      modelo_desconto_qual: {
        type: Sequelize.ENUM('flat', 'ponderado'),
        allowNull: false,
      },
      motivo_versao: { type: Sequelize.TEXT, allowNull: false },
      aprovado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('tb_historico_contrato', {
      fields: ['contrato_id', 'versao'],
      type: 'unique',
      name: 'uk_contrato_versao',
    });
    await queryInterface.addIndex('tb_historico_contrato', ['contrato_id'], { name: 'idx_hist_contrato' });
    await queryInterface.addIndex('tb_historico_contrato', ['contrato_id', 'vigencia_inicio'], { name: 'idx_hist_vigencia' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_historico_contrato');
  },
};
