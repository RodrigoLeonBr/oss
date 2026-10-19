'use strict';

// Filtro opcional por CBO (ocupação) no mapa de produção.
// Prefixo: 4 díg = família, 6 díg = ocupação. NULL = sem restrição de CBO.
module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn('tb_mapa_producao', 'cbo', {
      type: Sequelize.STRING(6),
      allowNull: true,
      after: 'valor_filtro',
    }),
  down: (queryInterface) => queryInterface.removeColumn('tb_mapa_producao', 'cbo'),
};
