'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_consolidacao_itens', {
      item_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      consolidacao_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_consolidacoes', key: 'consolidacao_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      indicador_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_indicadores', key: 'indicador_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      soma_realizado: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      media_realizado: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      meta_periodo: { type: Sequelize.DECIMAL(15, 4), allowNull: true },
      percentual_cumprimento: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
      faixa: {
        type: Sequelize.ENUM('acima_meta', 'entre_85_100', 'entre_70_84', 'abaixo_70'),
        allowNull: true,
      },
      meses_cumpridos: { type: Sequelize.TINYINT, allowNull: true },
      meses_totais: { type: Sequelize.TINYINT, allowNull: true },
      desconto_periodo: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('tb_consolidacao_itens', {
      fields: ['consolidacao_id', 'indicador_id'],
      type: 'unique',
      name: 'uk_consol_item',
    });
    await queryInterface.addIndex('tb_consolidacao_itens', ['consolidacao_id'], { name: 'idx_consol_item_consol' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_consolidacao_itens');
  },
};
