'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_historico_indicadores', {
      hist_ind_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      indicador_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_indicadores', key: 'indicador_id' },
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
      versao: { type: Sequelize.INTEGER, allowNull: false },
      vigencia_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      vigencia_fim: { type: Sequelize.DATEONLY, allowNull: true },
      nome: { type: Sequelize.STRING(300), allowNull: false },
      formula_calculo: { type: Sequelize.TEXT, allowNull: true },
      periodicidade: { type: Sequelize.STRING(30), allowNull: false },
      peso_perc: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      meta_tipo: { type: Sequelize.STRING(30), allowNull: false },
      fonte_dados: { type: Sequelize.STRING(30), allowNull: false },
      motivo_versao: { type: Sequelize.TEXT, allowNull: false },
      alterado_por: {
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

    await queryInterface.addIndex('tb_historico_indicadores', ['indicador_id'], { name: 'idx_hist_ind' });
    await queryInterface.addIndex('tb_historico_indicadores', ['indicador_id', 'vigencia_inicio'], { name: 'idx_hist_ind_vigencia' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_historico_indicadores');
  },
};
