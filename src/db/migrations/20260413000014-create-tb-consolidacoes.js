'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_consolidacoes', {
      consolidacao_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      unidade_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_unidades', key: 'unidade_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipo_periodo: {
        type: Sequelize.ENUM('trimestral', 'quadrimestral'),
        allowNull: false,
      },
      periodo_numero: { type: Sequelize.TINYINT, allowNull: false },
      ano: { type: Sequelize.SMALLINT, allowNull: false },
      data_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      data_fim: { type: Sequelize.DATEONLY, allowNull: false },
      status: {
        type: Sequelize.ENUM('gerado', 'validado', 'arquivado'),
        allowNull: false,
        defaultValue: 'gerado',
      },
      gerado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      gerado_por: { type: Sequelize.CHAR(36), allowNull: true },
    });

    await queryInterface.addConstraint('tb_consolidacoes', {
      fields: ['unidade_id', 'tipo_periodo', 'periodo_numero', 'ano'],
      type: 'unique',
      name: 'uk_consolidacao',
    });
    await queryInterface.addIndex('tb_consolidacoes', ['unidade_id'], { name: 'idx_consol_unidade' });
    await queryInterface.addIndex('tb_consolidacoes', ['ano', 'tipo_periodo'], { name: 'idx_consol_ano' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_consolidacoes');
  },
};
