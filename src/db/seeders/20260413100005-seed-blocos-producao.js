'use strict';

const U_HMA        = 'uuuu0001-0001-0001-0001-000000000001';
const U_UNACON     = 'uuuu0002-0002-0002-0002-000000000002';
const U_UPA_CILLOS = 'uuuu0003-0003-0003-0003-000000000003';
const U_UPA_DROSA  = 'uuuu0004-0004-0004-0004-000000000004';
const U_UPA_ZANAGA = 'uuuu0005-0005-0005-0005-000000000005';

// ─── HMA — 8 blocos reais (6º Aditivo Contrato 009/2023) ────────────────────
const B_HMA_PS    = 'bbbb0001-0001-0001-0001-000000000001'; // Pronto Socorro
const B_HMA_CC    = 'bbbb0002-0002-0002-0002-000000000002'; // Centro Cirúrgico
const B_HMA_PC    = 'bbbb0003-0003-0003-0003-000000000003'; // Pequenas Cirurgias
const B_HMA_SADTI = 'bbbb0004-0004-0004-0004-000000000004'; // SADT Interno (Referência)
const B_HMA_SADTE = 'bbbb0005-0005-0005-0005-000000000005'; // SADT Externo (Rede Pública)
const B_HMA_BS    = 'bbbb0006-0006-0006-0006-000000000006'; // Banco de Sangue
const B_HMA_HD    = 'bbbb0007-0007-0007-0007-000000000007'; // Hemodiálise
const B_HMA_TXOC  = 'bbbb0008-0008-0008-0008-000000000008'; // Taxa de Ocupação

// ─── UNACON — 3 blocos reais ─────────────────────────────────────────────────
const B_UNA_QT   = 'bbbb0009-0009-0009-0009-000000000009'; // Quimioterapia
const B_UNA_PC   = 'bbbb0010-0010-0010-0010-000000000010'; // Procedimentos Cirúrgicos
const B_UNA_SADT = 'bbbb0011-0011-0011-0011-000000000011'; // SADT

// ─── UPA Cillos — 2 blocos ───────────────────────────────────────────────────
const B_CIL_PA   = 'bbbb0012-0012-0012-0012-000000000012'; // Pronto Atendimento
const B_CIL_SADT = 'bbbb0013-0013-0013-0013-000000000013'; // SADT Referência

// ─── UPA Dona Rosa — 2 blocos ────────────────────────────────────────────────
const B_DR_PA   = 'bbbb0014-0014-0014-0014-000000000014'; // Atendimento
const B_DR_SADT = 'bbbb0015-0015-0015-0015-000000000015'; // SADT

// ─── UPA Zanaga — 1 bloco placeholder ────────────────────────────────────────
const B_ZAN_PA = 'bbbb0016-0016-0016-0016-000000000016';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tb_blocos_producao', [
      // ── HMA ──────────────────────────────────────────────────────────────────
      {
        bloco_id: B_HMA_PS,
        unidade_id: U_HMA,
        codigo: 'HMA-PS',
        nome: 'Pronto Socorro',
        valor_mensal_alocado: 2500000.00,
        percentual_peso_bloco: 23.03,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_CC,
        unidade_id: U_HMA,
        codigo: 'HMA-CC',
        nome: 'Centro Cirúrgico',
        valor_mensal_alocado: 2200000.00,
        percentual_peso_bloco: 20.27,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_PC,
        unidade_id: U_HMA,
        codigo: 'HMA-PC',
        nome: 'Pequenas Cirurgias',
        valor_mensal_alocado: 800000.00,
        percentual_peso_bloco: 7.37,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_SADTI,
        unidade_id: U_HMA,
        codigo: 'HMA-SADTI',
        nome: 'SADT Interno (Referência)',
        valor_mensal_alocado: 3200000.00,
        percentual_peso_bloco: 29.47,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_SADTE,
        unidade_id: U_HMA,
        codigo: 'HMA-SADTE',
        nome: 'SADT Externo (Rede Pública)',
        valor_mensal_alocado: 600000.00,
        percentual_peso_bloco: 5.53,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_BS,
        unidade_id: U_HMA,
        codigo: 'HMA-BS',
        nome: 'Banco de Sangue',
        valor_mensal_alocado: 350000.00,
        percentual_peso_bloco: 3.23,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_HD,
        unidade_id: U_HMA,
        codigo: 'HMA-HD',
        nome: 'Hemodiálise',
        valor_mensal_alocado: 505769.19,
        percentual_peso_bloco: 4.66,
        ativo: 1,
      },
      {
        bloco_id: B_HMA_TXOC,
        unidade_id: U_HMA,
        codigo: 'HMA-TXOC',
        nome: 'Taxa de Ocupação',
        valor_mensal_alocado: 700000.00,
        percentual_peso_bloco: 6.45,
        ativo: 1,
      },

      // ── UNACON ───────────────────────────────────────────────────────────────
      {
        bloco_id: B_UNA_QT,
        unidade_id: U_UNACON,
        codigo: 'UNA-QT',
        nome: 'Quimioterapia',
        valor_mensal_alocado: 1500000.00,
        percentual_peso_bloco: 57.69,
        ativo: 1,
      },
      {
        bloco_id: B_UNA_PC,
        unidade_id: U_UNACON,
        codigo: 'UNA-PC',
        nome: 'Procedimentos Cirúrgicos',
        valor_mensal_alocado: 700000.00,
        percentual_peso_bloco: 26.92,
        ativo: 1,
      },
      {
        bloco_id: B_UNA_SADT,
        unidade_id: U_UNACON,
        codigo: 'UNA-SADT',
        nome: 'SADT Oncológico',
        valor_mensal_alocado: 400000.00,
        percentual_peso_bloco: 15.38,
        ativo: 1,
      },

      // ── UPA Cillos ────────────────────────────────────────────────────────────
      {
        bloco_id: B_CIL_PA,
        unidade_id: U_UPA_CILLOS,
        codigo: 'CIL-PA',
        nome: 'Pronto Atendimento',
        valor_mensal_alocado: 1000000.00,
        percentual_peso_bloco: 71.43,
        ativo: 1,
      },
      {
        bloco_id: B_CIL_SADT,
        unidade_id: U_UPA_CILLOS,
        codigo: 'CIL-SADT',
        nome: 'SADT (Referência)',
        valor_mensal_alocado: 400000.00,
        percentual_peso_bloco: 28.57,
        ativo: 1,
      },

      // ── UPA Dona Rosa ─────────────────────────────────────────────────────────
      {
        bloco_id: B_DR_PA,
        unidade_id: U_UPA_DROSA,
        codigo: 'DR-PA',
        nome: 'Atendimento Médico',
        valor_mensal_alocado: 1500000.00,
        percentual_peso_bloco: 62.50,
        ativo: 1,
      },
      {
        bloco_id: B_DR_SADT,
        unidade_id: U_UPA_DROSA,
        codigo: 'DR-SADT',
        nome: 'SADT',
        valor_mensal_alocado: 900000.00,
        percentual_peso_bloco: 37.50,
        ativo: 1,
      },

      // ── UPA Zanaga (placeholder — sem PDF de indicadores) ─────────────────────
      {
        bloco_id: B_ZAN_PA,
        unidade_id: U_UPA_ZANAGA,
        codigo: 'ZAN-PA',
        nome: 'Pronto Atendimento',
        valor_mensal_alocado: 2400000.00,
        percentual_peso_bloco: 100.00,
        ativo: 1,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_blocos_producao', null, {});
  },
};
