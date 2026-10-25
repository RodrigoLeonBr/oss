'use strict';

/**
 * De-para indicador → filtro de produção (grupo/subgrupo/forma/procedimento),
 * usado pela Ponte de Produção para somar SIA/SIH e comparar com o informado.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tb_mapa_producao', {
      mapa_id: { type: Sequelize.CHAR(36), primaryKey: true, defaultValue: Sequelize.literal('(UUID())') },
      indicador_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'tb_indicadores', key: 'indicador_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fonte: { type: Sequelize.ENUM('sia', 'sih'), allowNull: false, defaultValue: 'sia' },
      tipo_filtro: { type: Sequelize.ENUM('grupo', 'subgrupo', 'forma', 'procedimento'), allowNull: false },
      valor_filtro: { type: Sequelize.STRING(10), allowNull: false },
      ativo: { type: Sequelize.TINYINT(1), allowNull: false, defaultValue: 1 },
      criado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      atualizado_em: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('tb_mapa_producao', ['indicador_id'], { name: 'idx_mapa_indicador' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tb_mapa_producao');
  },
};
