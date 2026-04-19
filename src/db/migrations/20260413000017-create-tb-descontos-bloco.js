'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_descontos_bloco', {
      desc_bloco_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('(UUID())'),
      },
      repasse_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_repasse_mensal', key: 'repasse_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      bloco_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_blocos_producao', key: 'bloco_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
      meta_mensal: { type: Sequelize.DECIMAL(15, 4), allowNull: false },
      valor_realizado: { type: Sequelize.DECIMAL(15, 4), allowNull: false },
      percentual_atingimento: { type: Sequelize.DECIMAL(8, 4), allowNull: false },
      faixa: {
        type: Sequelize.ENUM('acima_meta', 'entre_85_100', 'entre_70_84', 'abaixo_70'),
        allowNull: false,
      },
      orcamento_bloco: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      percentual_desconto: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      valor_desconto: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      auditado: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 0 },
      auditado_por: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tb_usuarios', key: 'usuario_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      data_auditoria: { type: Sequelize.DATE, allowNull: true },
      criado_em: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tb_descontos_bloco', ['repasse_id'], { name: 'idx_desc_bloco_repasse' });
    await queryInterface.addIndex('tb_descontos_bloco', ['mes_referencia'], { name: 'idx_desc_bloco_mes' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_descontos_bloco');
  },
};
