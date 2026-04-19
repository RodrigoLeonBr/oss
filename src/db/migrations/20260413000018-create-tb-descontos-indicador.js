'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_descontos_indicador', {
      desc_ind_id: {
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
      acomp_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_acompanhamento_mensal', key: 'acomp_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      indicador_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_indicadores', key: 'indicador_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      mes_referencia: { type: Sequelize.DATEONLY, allowNull: false },
      modelo_desconto: {
        type: Sequelize.ENUM('flat', 'ponderado'),
        allowNull: false,
      },
      peso_indicador: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
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

    await queryInterface.addIndex('tb_descontos_indicador', ['repasse_id'], { name: 'idx_desc_ind_repasse' });
    await queryInterface.addIndex('tb_descontos_indicador', ['mes_referencia'], { name: 'idx_desc_ind_mes' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_descontos_indicador');
  },
};
