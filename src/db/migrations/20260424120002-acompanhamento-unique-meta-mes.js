'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint('tb_acompanhamento_mensal', 'uk_acomp_ind_mes');
    await queryInterface.addConstraint('tb_acompanhamento_mensal', {
      fields: ['meta_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_acomp_meta_mes',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('tb_acompanhamento_mensal', 'uk_acomp_meta_mes');
    await queryInterface.addConstraint('tb_acompanhamento_mensal', {
      fields: ['indicador_id', 'mes_referencia'],
      type: 'unique',
      name: 'uk_acomp_ind_mes',
    });
  },
};
