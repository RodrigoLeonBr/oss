'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_contratos', {
      contrato_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      oss_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_oss', key: 'oss_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      numero: { type: Sequelize.STRING(50), allowNull: false },
      tipo: {
        type: Sequelize.ENUM('contrato_gestao', 'chamamento_publico', 'convenio', 'outro'),
        allowNull: false,
      },
      data_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      data_fim: { type: Sequelize.DATEONLY, allowNull: false },
      valor_mensal_base: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      perc_fixo: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 90.00 },
      perc_variavel: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 10.00 },
      modelo_desconto_qual: {
        type: Sequelize.ENUM('flat', 'ponderado'),
        allowNull: false,
      },
      numero_aditivos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('Ativo', 'Encerrado', 'Suspenso', 'Rompido'),
        allowNull: false,
        defaultValue: 'Ativo',
      },
      observacoes: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.addIndex('tb_contratos', ['oss_id'], { name: 'idx_contratos_oss' });
    await queryInterface.addIndex('tb_contratos', ['status'], { name: 'idx_contratos_status' });

    await queryInterface.sequelize.query(
      'ALTER TABLE tb_contratos ADD COLUMN valor_anual DECIMAL(15,2) GENERATED ALWAYS AS (valor_mensal_base * 12) STORED AFTER valor_mensal_base'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_contratos');
  },
};
