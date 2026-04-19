'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_acompanhamento_mensal', {
      acomp_id: {
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
      meta_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_metas', key: 'meta_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
      meta_vigente_mensal: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      meta_vigente_qualit: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      valor_realizado: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      variacao_vs_mes_ant: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
      status_cumprimento: {
        type: Sequelize.ENUM('cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando'),
        allowNull: false,
        defaultValue: 'aguardando',
      },
      faixa_producao: {
        type: Sequelize.ENUM('acima_meta', 'entre_85_100', 'entre_70_84', 'abaixo_70'),
        allowNull: true,
      },
      status_implantacao: {
        type: Sequelize.ENUM('nao_iniciado', 'em_prazo', 'cumprido', 'vencido'),
        allowNull: true,
      },
      data_cumprimento_impl: { type: Sequelize.DATEONLY, allowNull: true },
      descricao_desvios: { type: Sequelize.TEXT, allowNull: true },
      status_aprovacao: {
        type: Sequelize.ENUM('rascunho', 'submetido', 'aprovado', 'rejeitado'),
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
      data_preenchimento: { type: Sequelize.DATE, allowNull: true },
      submetido_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      data_submissao: { type: Sequelize.DATE, allowNull: true },
      aprovado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      data_aprovacao: { type: Sequelize.DATE, allowNull: true },
      motivo_rejeicao: { type: Sequelize.TEXT, allowNull: true },
      desconto_estimado: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      versao: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
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

    await queryInterface.addConstraint('tb_acompanhamento_mensal', {
      fields: ['indicador_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_acomp_ind_mes',
    });
    await queryInterface.addIndex('tb_acompanhamento_mensal', ['mes_referencia'], { name: 'idx_acomp_mes' });
    await queryInterface.addIndex('tb_acompanhamento_mensal', ['status_cumprimento'], { name: 'idx_acomp_status' });
    await queryInterface.addIndex('tb_acompanhamento_mensal', ['status_aprovacao'], { name: 'idx_acomp_aprovacao' });
    await queryInterface.addIndex('tb_acompanhamento_mensal', ['indicador_id'], { name: 'idx_acomp_indicador' });

    // GENERATED column for percentual_cumprimento
    await queryInterface.sequelize.query(`
      ALTER TABLE tb_acompanhamento_mensal
      ADD COLUMN percentual_cumprimento DECIMAL(8,4) GENERATED ALWAYS AS (
        CASE
          WHEN meta_vigente_mensal IS NOT NULL AND meta_vigente_mensal > 0
            THEN ROUND((valor_realizado / meta_vigente_mensal) * 100, 4)
          ELSE NULL
        END
      ) STORED AFTER valor_realizado
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_acompanhamento_mensal');
  },
};
