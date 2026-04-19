'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_repasse_mensal', {
      repasse_id: {
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
      historico_contrato_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_historico_contrato', key: 'historico_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
      valor_mensal_base: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      parcela_fixa: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      parcela_variavel: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      desconto_producao_total: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      desconto_qualidade_total: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      status: {
        type: Sequelize.ENUM('calculado', 'validado', 'aprovado', 'pago'),
        allowNull: false,
        defaultValue: 'calculado',
      },
      calculado_em: { type: Sequelize.DATE, allowNull: true },
      validado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      data_validacao: { type: Sequelize.DATE, allowNull: true },
      aprovado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      data_aprovacao: { type: Sequelize.DATE, allowNull: true },
      data_pagamento: { type: Sequelize.DATE, allowNull: true },
      observacoes: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.addConstraint('tb_repasse_mensal', {
      fields: ['contrato_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_repasse_contrato_mes',
    });
    await queryInterface.addIndex('tb_repasse_mensal', ['mes_referencia'], { name: 'idx_repasse_mes' });
    await queryInterface.addIndex('tb_repasse_mensal', ['status'], { name: 'idx_repasse_status' });

    // GENERATED columns
    await queryInterface.sequelize.query(`
      ALTER TABLE tb_repasse_mensal
        ADD COLUMN desconto_total DECIMAL(15,2) GENERATED ALWAYS AS (desconto_producao_total + desconto_qualidade_total) STORED AFTER desconto_qualidade_total,
        ADD COLUMN repasse_final DECIMAL(15,2) GENERATED ALWAYS AS (valor_mensal_base - desconto_producao_total - desconto_qualidade_total) STORED AFTER desconto_total,
        ADD COLUMN percentual_retido DECIMAL(5,2) GENERATED ALWAYS AS (ROUND(((desconto_producao_total + desconto_qualidade_total) / valor_mensal_base) * 100, 2)) STORED AFTER repasse_final
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_repasse_mensal');
  },
};
