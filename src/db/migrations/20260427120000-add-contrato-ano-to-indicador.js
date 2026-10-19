'use strict';

/**
 * Indicador passa a gravar explicitamente contrato e ano (além da unidade).
 * Facilita escopo por contrato/ano e a duplicação ao renovar contrato.
 * Backfill: contrato_id via unidade→contrato; ano via vigência do indicador ou início do contrato.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_indicadores', 'contrato_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
    });
    await queryInterface.addColumn('tb_indicadores', 'ano', {
      type: Sequelize.SMALLINT,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE tb_indicadores i
      INNER JOIN tb_unidades u ON u.unidade_id = i.unidade_id
      INNER JOIN tb_contratos c ON c.contrato_id = u.contrato_id
      SET
        i.contrato_id = u.contrato_id,
        i.ano = YEAR(COALESCE(i.vigencia_inicio, c.data_inicio))
    `);

    await queryInterface.addIndex('tb_indicadores', ['contrato_id'], {
      name: 'idx_indicadores_contrato',
    });
    await queryInterface.addIndex('tb_indicadores', ['ano'], {
      name: 'idx_indicadores_ano',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tb_indicadores', 'idx_indicadores_contrato');
    await queryInterface.removeIndex('tb_indicadores', 'idx_indicadores_ano');
    await queryInterface.removeColumn('tb_indicadores', 'contrato_id');
    await queryInterface.removeColumn('tb_indicadores', 'ano');
  },
};
