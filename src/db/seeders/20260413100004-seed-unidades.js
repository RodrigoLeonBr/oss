'use strict';

// Contratos reais (6º Aditivo 009/2023 = SCMC; 066/2024 = INDSH Dona Rosa; 002/2025 = INDSH Zanaga)
const CONTRATO_009 = 'cccc0001-0001-0001-0001-000000000001';
const CONTRATO_066 = 'cccc0002-0002-0002-0002-000000000002';
const CONTRATO_002 = 'cccc0003-0003-0003-0003-000000000003';

const U_HMA        = 'uuuu0001-0001-0001-0001-000000000001';
const U_UNACON     = 'uuuu0002-0002-0002-0002-000000000002';
const U_UPA_CILLOS = 'uuuu0003-0003-0003-0003-000000000003';
const U_UPA_DROSA  = 'uuuu0004-0004-0004-0004-000000000004';
const U_UPA_ZANAGA = 'uuuu0005-0005-0005-0005-000000000005';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tb_unidades', [
      {
        unidade_id: U_HMA,
        contrato_id: CONTRATO_009,
        nome: 'Hospital Municipal Dr. Waldemar Tebaldi',
        sigla: 'HMA',
        tipo: 'hospital',
        cnes: '2080125',
        porte: 'Grande Porte',
        capacidade_leitos: 222,
        especialidades: JSON.stringify([
          'Urgência/Emergência', 'Clínica Médica', 'Cirurgia Geral', 'Centro Cirúrgico',
          'UTI Adulto', 'UTI Neonatal', 'Pediatria', 'Ortopedia', 'Obstetrícia',
          'SADT', 'Hemodiálise', 'Banco de Sangue', 'Câmara Hiperbárica',
        ]),
        valor_mensal_unidade: 10855769.19,
        percentual_peso: 73.07,
        ativa: 1,
      },
      {
        unidade_id: U_UNACON,
        contrato_id: CONTRATO_009,
        nome: 'UNACON — Unidade de Assistência de Alta Complexidade em Oncologia',
        sigla: 'UNACON',
        tipo: 'unacon',
        cnes: '2080126',
        porte: 'Especializado',
        capacidade_leitos: 30,
        especialidades: JSON.stringify([
          'Oncologia', 'Quimioterapia', 'Cirurgia Oncológica',
          'Cirurgia Reparadora', 'Tomografia', 'Ultrassonografia',
        ]),
        valor_mensal_unidade: 2600000.00,
        percentual_peso: 17.50,
        ativa: 1,
      },
      {
        unidade_id: U_UPA_CILLOS,
        contrato_id: CONTRATO_009,
        nome: 'UPA 24h Avenida de Cillos',
        sigla: 'UPA-CIL',
        tipo: 'upa',
        cnes: '7471777',
        porte: 'Porte III',
        capacidade_leitos: 12,
        especialidades: JSON.stringify(['Urgência', 'Emergência', 'Pediatria', 'SADT']),
        valor_mensal_unidade: 1400000.00,
        percentual_peso: 9.43,
        ativa: 1,
      },
      {
        unidade_id: U_UPA_DROSA,
        contrato_id: CONTRATO_066,
        nome: 'UPA 24h Dona Rosa',
        sigla: 'UPA-DR',
        tipo: 'upa',
        cnes: '7654322',
        porte: 'Porte III',
        capacidade_leitos: 12,
        especialidades: JSON.stringify(['Clínico Geral', 'Emergência', 'Pediatria', 'SADT']),
        valor_mensal_unidade: 2400000.00,
        percentual_peso: 100.00,
        ativa: 1,
      },
      {
        unidade_id: U_UPA_ZANAGA,
        contrato_id: CONTRATO_002,
        nome: 'UPA 24h Zanaga',
        sigla: 'UPA-ZAN',
        tipo: 'upa',
        cnes: '7654323',
        porte: 'Porte III',
        capacidade_leitos: 10,
        especialidades: JSON.stringify(['Urgência', 'Emergência']),
        valor_mensal_unidade: 2400000.00,
        percentual_peso: 100.00,
        ativa: 1,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_unidades', null, {});
  },
};
