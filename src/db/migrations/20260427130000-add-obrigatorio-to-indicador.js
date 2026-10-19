'use strict';

/**
 * Indicador pode ser obrigatório (entra no cálculo de metas) ou informativo.
 * Informativos (obrigatorio=0) ficam fora do Dashboard e do Relatório CMS.
 * Backfill: todos os atuais como obrigatórios.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_indicadores', 'obrigatorio', {
      type: Sequelize.TINYINT(1),
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.sequelize.query('UPDATE tb_indicadores SET obrigatorio = 1');
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tb_indicadores', 'obrigatorio');
  },
};
