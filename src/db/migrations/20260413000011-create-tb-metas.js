'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_metas', {
      meta_id: {
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
      versao: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      vigencia_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      vigencia_fim: { type: Sequelize.DATEONLY, allowNull: true },
      meta_mensal: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      meta_anual: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      meta_valor_qualit: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      meta_minima: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      meta_parcial: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      unidade_medida: { type: Sequelize.STRING(50), allowNull: true },
      observacoes: { type: Sequelize.TEXT, allowNull: true },
      prazo_implantacao: { type: Sequelize.DATEONLY, allowNull: true },
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
      atualizado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_metas', ['indicador_id'], { name: 'idx_metas_indicador' });
    await queryInterface.addIndex('tb_metas', ['indicador_id', 'vigencia_inicio'], { name: 'idx_metas_vigencia' });
    await queryInterface.addIndex('tb_metas', ['aditivo_id'], { name: 'idx_metas_aditivo' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_metas');
  },
};
