'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_unidades', {
      unidade_id: {
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
      nome: { type: Sequelize.STRING(200), allowNull: false },
      sigla: { type: Sequelize.STRING(20), allowNull: false },
      tipo: {
        type: Sequelize.ENUM('hospital', 'upa', 'unacon', 'pa', 'ambulatorio', 'outro'),
        allowNull: false,
      },
      cnes: { type: Sequelize.STRING(20), allowNull: true },
      endereco: { type: Sequelize.TEXT, allowNull: true },
      porte: { type: Sequelize.STRING(100), allowNull: true },
      capacidade_leitos: { type: Sequelize.INTEGER, allowNull: true },
      especialidades: { type: Sequelize.JSON, allowNull: true },
      responsavel_tecnico: { type: Sequelize.STRING(200), allowNull: true },
      valor_mensal_unidade: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      percentual_peso: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      ativa: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
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

    await queryInterface.addIndex('tb_unidades', ['contrato_id'], { name: 'idx_unidades_contrato' });
    await queryInterface.addIndex('tb_unidades', ['tipo'], { name: 'idx_unidades_tipo' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_unidades');
  },
};
