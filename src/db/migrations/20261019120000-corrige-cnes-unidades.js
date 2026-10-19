'use strict';

// CNES reais das unidades (fonte: SMS Americana) — usados p/ coletar SIA/SIH no consultaprod.
// HMA e UNACON compartilham o mesmo estabelecimento CNES.
const CNES = {
  'uuuu0001-0001-0001-0001-000000000001': '2058790', // HMA
  'uuuu0002-0002-0002-0002-000000000002': '2058790', // UNACON
  'uuuu0004-0004-0004-0004-000000000004': '4777220', // UPA Dona Rosa
  'uuuu0005-0005-0005-0005-000000000005': '2028050', // UPA Zanaga
  // UPA Cillos (uuuu0003) já estava correto: 7471777
};

const ANTIGO = {
  'uuuu0001-0001-0001-0001-000000000001': '2080125',
  'uuuu0002-0002-0002-0002-000000000002': '2080126',
  'uuuu0004-0004-0004-0004-000000000004': '7654322',
  'uuuu0005-0005-0005-0005-000000000005': '7654323',
};

async function aplicar(queryInterface, mapa) {
  for (const [unidade_id, cnes] of Object.entries(mapa)) {
    await queryInterface.bulkUpdate('tb_unidades', { cnes }, { unidade_id });
  }
}

module.exports = {
  up: (queryInterface) => aplicar(queryInterface, CNES),
  down: (queryInterface) => aplicar(queryInterface, ANTIGO),
};
