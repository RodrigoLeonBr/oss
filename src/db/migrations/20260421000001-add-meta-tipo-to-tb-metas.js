'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tb_metas', 'meta_tipo', {
      type: Sequelize.ENUM('maior_igual', 'menor_igual'),
      allowNull: false,
      defaultValue: 'maior_igual',
      after: 'meta_valor_qualit',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tb_metas', 'meta_tipo');
  },
};
