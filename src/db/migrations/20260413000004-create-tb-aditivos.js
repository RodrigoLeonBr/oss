'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_aditivos', {
      aditivo_id: {
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
      numero_aditivo: { type: Sequelize.INTEGER, allowNull: false },
      data_assinatura: { type: Sequelize.DATEONLY, allowNull: false },
      data_vigencia_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      tipo_aditivo: {
        type: Sequelize.ENUM(
          'prorrogacao', 'reajuste_financeiro', 'alteracao_metas',
          'alteracao_indicadores', 'alteracao_blocos', 'alteracao_regras', 'misto'
        ),
        allowNull: false,
      },
      descricao_sumaria: { type: Sequelize.STRING(500), allowNull: false },
      conteudo_completo: { type: Sequelize.TEXT('long'), allowNull: true },
      documento_url: { type: Sequelize.STRING(500), allowNull: true },
      valor_anterior: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      novo_valor_mensal: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      nova_data_fim: { type: Sequelize.DATEONLY, allowNull: true },
      ipca_aplicado: { type: Sequelize.DECIMAL(6, 4), allowNull: true },
      aplicado: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      aplicado_em: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.addConstraint('tb_aditivos', {
      fields: ['contrato_id', 'numero_aditivo'],
      type: 'unique',
      name: 'uk_aditivo_numero',
    });
    await queryInterface.addIndex('tb_aditivos', ['contrato_id'], { name: 'idx_aditivos_contrato' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_aditivos');
  },
};
