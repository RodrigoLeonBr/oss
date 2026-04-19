'use strict';

const OSS_SCMC = '11111111-1111-1111-1111-111111111111';
const OSS_INDSH = '22222222-2222-2222-2222-222222222222';

// Contrato 009/2023 → SCMC → HMA + UNACON + UPA Cillos (6º Termo Aditivo vigente)
const CONTRATO_009 = 'cccc0001-0001-0001-0001-000000000001';
// Contrato 066/2024 → INDSH → UPA Dona Rosa (2º Termo Aditivo vigente)
const CONTRATO_066 = 'cccc0002-0002-0002-0002-000000000002';
// Contrato 002/2025 → INDSH → UPA Zanaga
const CONTRATO_002 = 'cccc0003-0003-0003-0003-000000000003';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tb_contratos', [
      {
        contrato_id: CONTRATO_009,
        oss_id: OSS_SCMC,
        numero: '009/2023',
        tipo: 'contrato_gestao',
        data_inicio: '2023-01-01',
        data_fim: '2027-12-31',
        valor_mensal_base: 14855769.19,
        perc_fixo: 90.00,
        perc_variavel: 10.00,
        modelo_desconto_qual: 'flat',
        status: 'Ativo',
        observacoes: 'Contrato de Gestão SCMC — HMA + UNACON + UPA Cillos. 6º Termo Aditivo vigente.',
      },
      {
        contrato_id: CONTRATO_066,
        oss_id: OSS_INDSH,
        numero: '066/2024',
        tipo: 'contrato_gestao',
        data_inicio: '2024-01-01',
        data_fim: '2028-12-31',
        valor_mensal_base: 2400000.00,
        perc_fixo: 85.00,
        perc_variavel: 15.00,
        modelo_desconto_qual: 'flat',
        status: 'Ativo',
        observacoes: 'Contrato de Gestão INDSH — UPA 24h Dona Rosa. 2º Termo Aditivo vigente.',
      },
      {
        contrato_id: CONTRATO_002,
        oss_id: OSS_INDSH,
        numero: '002/2025',
        tipo: 'contrato_gestao',
        data_inicio: '2025-01-01',
        data_fim: '2029-12-31',
        valor_mensal_base: 2400000.00,
        perc_fixo: 85.00,
        perc_variavel: 15.00,
        modelo_desconto_qual: 'flat',
        status: 'Ativo',
        observacoes: 'Contrato de Gestão INDSH — UPA 24h Zanaga.',
      },
    ]);

    await queryInterface.bulkInsert('tb_historico_contrato', [
      {
        contrato_id: CONTRATO_009,
        versao: 1,
        vigencia_inicio: '2023-01-01',
        valor_mensal_base: 14855769.19,
        perc_fixo: 90.00,
        perc_variavel: 10.00,
        modelo_desconto_qual: 'flat',
        motivo_versao: '6º Termo Aditivo — vigência 2026. SCMC: HMA + UNACON + UPA Cillos.',
      },
      {
        contrato_id: CONTRATO_066,
        versao: 1,
        vigencia_inicio: '2024-01-01',
        valor_mensal_base: 2400000.00,
        perc_fixo: 85.00,
        perc_variavel: 15.00,
        modelo_desconto_qual: 'flat',
        motivo_versao: '2º Termo Aditivo — vigência 2026. INDSH: UPA Dona Rosa.',
      },
      {
        contrato_id: CONTRATO_002,
        versao: 1,
        vigencia_inicio: '2025-01-01',
        valor_mensal_base: 2400000.00,
        perc_fixo: 85.00,
        perc_variavel: 15.00,
        modelo_desconto_qual: 'flat',
        motivo_versao: 'Versão inicial. INDSH: UPA Zanaga.',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_historico_contrato', null, {});
    await queryInterface.bulkDelete('tb_contratos', null, {});
  },
};
