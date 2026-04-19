'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_execucao_financeira', {
      exec_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      rubrica_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_rubricas', key: 'rubrica_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
      valor_orcado: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      valor_realizado: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
      status_aprovacao: {
        type: Sequelize.ENUM('rascunho', 'submetido', 'aprovado'),
        allowNull: false,
        defaultValue: 'rascunho',
      },
      preenchido_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
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

    await queryInterface.addConstraint('tb_execucao_financeira', {
      fields: ['rubrica_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_exec_rubrica_mes',
    });
    await queryInterface.addIndex('tb_execucao_financeira', ['mes_referencia'], { name: 'idx_exec_mes' });
    await queryInterface.addIndex('tb_execucao_financeira', ['rubrica_id'], { name: 'idx_exec_rubrica' });

    await queryInterface.sequelize.query(`
      ALTER TABLE tb_execucao_financeira
        ADD COLUMN variacao DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(valor_realizado,0) - valor_orcado) STORED AFTER valor_realizado,
        ADD COLUMN variacao_perc DECIMAL(8,4) GENERATED ALWAYS AS (
          CASE WHEN valor_orcado <> 0
            THEN ROUND(((COALESCE(valor_realizado,0) - valor_orcado) / valor_orcado) * 100, 4)
            ELSE NULL
          END
        ) STORED AFTER variacao
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_execucao_financeira');
  },
};
