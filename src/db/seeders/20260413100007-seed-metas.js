'use strict';

/**
 * Metas reais 2026 — Contrato 009/2023 (6º Aditivo) e 066/2024 (2º Aditivo)
 *
 * Estratégia: busca IDs de tb_indicadores por código e insere tb_metas com
 * os valores reais extraídos dos PDFs de indicadores de cada unidade.
 *
 * Vigência padrão: 2026-01-01 (sem data de fim = vigente até novo aditivo).
 */

// ─── Metas quantitativas (meta_mensal + meta_anual) ─────────────────────────
// código → { meta_mensal, meta_anual }
const METAS_QUANT = {
  // HMA — Pronto Socorro
  'HMA-QT-PS-01': { meta_mensal: 12000,  meta_anual: 144000 },

  // HMA — Centro Cirúrgico
  'HMA-QT-CC-01': { meta_mensal: 12,     meta_anual: 144 },
  'HMA-QT-CC-02': { meta_mensal: 12,     meta_anual: 144 },
  'HMA-QT-CC-03': { meta_mensal: 70,     meta_anual: 840 },
  'HMA-QT-CC-04': { meta_mensal: 70,     meta_anual: 840 },
  'HMA-QT-CC-05': { meta_mensal: 50,     meta_anual: 600 },
  'HMA-QT-CC-06': { meta_mensal: 5,      meta_anual: 60 },
  'HMA-QT-CC-07': { meta_mensal: 5,      meta_anual: 60 },
  'HMA-QT-CC-08': { meta_mensal: 90,     meta_anual: 1080 },

  // HMA — Pequenas Cirurgias
  'HMA-QT-PC-01': { meta_mensal: 100,    meta_anual: 1200 },
  'HMA-QT-PC-02': { meta_mensal: 30,     meta_anual: 360 },
  'HMA-QT-PC-03': { meta_mensal: 20,     meta_anual: 240 },
  'HMA-QT-PC-04': { meta_mensal: 20,     meta_anual: 240 },
  'HMA-QT-PC-05': { meta_mensal: 30,     meta_anual: 360 },
  'HMA-QT-PC-06': { meta_mensal: 15,     meta_anual: 180 },

  // HMA — SADT Interno
  'HMA-QT-SADTI-01': { meta_mensal: 3500,  meta_anual: 42000 },
  'HMA-QT-SADTI-02': { meta_mensal: 20,    meta_anual: 240 },
  'HMA-QT-SADTI-03': { meta_mensal: 26000, meta_anual: 312000 },
  'HMA-QT-SADTI-04': { meta_mensal: 300,   meta_anual: 3600 },
  'HMA-QT-SADTI-05': { meta_mensal: 150,   meta_anual: 1800 },
  'HMA-QT-SADTI-06': { meta_mensal: 8,     meta_anual: 96 },
  'HMA-QT-SADTI-07': { meta_mensal: 1,     meta_anual: 12 },
  'HMA-QT-SADTI-08': { meta_mensal: 1,     meta_anual: 12 },
  'HMA-QT-SADTI-09': { meta_mensal: 1,     meta_anual: 12 },
  'HMA-QT-SADTI-10': { meta_mensal: 15,    meta_anual: 180 },
  'HMA-QT-SADTI-11': { meta_mensal: 2,     meta_anual: 24 },
  'HMA-QT-SADTI-12': { meta_mensal: 2,     meta_anual: 24 },
  'HMA-QT-SADTI-13': { meta_mensal: 35,    meta_anual: 420 },
  'HMA-QT-SADTI-14': { meta_mensal: 10,    meta_anual: 120 },
  'HMA-QT-SADTI-15': { meta_mensal: 2,     meta_anual: 24 },
  'HMA-QT-SADTI-16': { meta_mensal: 20,    meta_anual: 240 },
  'HMA-QT-SADTI-17': { meta_mensal: 10,    meta_anual: 120 },
  'HMA-QT-SADTI-18': { meta_mensal: 2,     meta_anual: 24 },
  'HMA-QT-SADTI-19': { meta_mensal: 2,     meta_anual: 24 },
  'HMA-QT-SADTI-20': { meta_mensal: 100,   meta_anual: 1200 },

  // HMA — SADT Externo
  'HMA-QT-SADTE-01': { meta_mensal: 200,   meta_anual: 2400 },
  'HMA-QT-SADTE-02': { meta_mensal: 450,   meta_anual: 5400 },
  'HMA-QT-SADTE-03': { meta_mensal: 5,     meta_anual: 60 },
  'HMA-QT-SADTE-04': { meta_mensal: 1,     meta_anual: 12 },
  'HMA-QT-SADTE-05': { meta_mensal: 50,    meta_anual: 600 },

  // HMA — Banco de Sangue
  'HMA-QT-BS-01':  { meta_mensal: 350,    meta_anual: 4200 },

  // HMA — Hemodiálise
  'HMA-QT-HD-01':  { meta_mensal: 120,    meta_anual: 1440 },
  'HMA-QT-HD-02':  { meta_mensal: 90,     meta_anual: 1080 },

  // HMA — Taxa de Ocupação (meta em %)
  'HMA-QT-TXOC-01': { meta_mensal: 40,    meta_anual: 480 },
  'HMA-QT-TXOC-02': { meta_mensal: 85,    meta_anual: 1020 },
  'HMA-QT-TXOC-03': { meta_mensal: 85,    meta_anual: 1020 },
  'HMA-QT-TXOC-04': { meta_mensal: 60,    meta_anual: 720 },
  'HMA-QT-TXOC-05': { meta_mensal: 90,    meta_anual: 1080 },
  'HMA-QT-TXOC-06': { meta_mensal: 90,    meta_anual: 1080 },

  // UNACON — Quimioterapia
  'UNA-QT-QT-01':   { meta_mensal: 354,   meta_anual: 4248 },

  // UNACON — Procedimentos Cirúrgicos
  'UNA-QT-PC-01':   { meta_mensal: 44,    meta_anual: 528 },
  'UNA-QT-PC-02':   { meta_mensal: 5,     meta_anual: 60 },
  'UNA-QT-PC-03':   { meta_mensal: 10,    meta_anual: 120 },

  // UNACON — SADT
  'UNA-QT-SADT-01': { meta_mensal: 50,    meta_anual: 600 },
  'UNA-QT-SADT-02': { meta_mensal: 250,   meta_anual: 3000 },

  // UPA Cillos
  'CIL-QT-PA-01':   { meta_mensal: 6750,  meta_anual: 81000 },
  'CIL-QT-SADT-01': { meta_mensal: 1000,  meta_anual: 12000 },
  'CIL-QT-SADT-02': { meta_mensal: 2260,  meta_anual: 27120 },

  // UPA Dona Rosa
  'DR-QT-PA-01':    { meta_mensal: 6750,  meta_anual: 81000 },
  'DR-QT-SADT-01':  { meta_mensal: 1450,  meta_anual: 17400 },
  'DR-QT-SADT-02':  { meta_mensal: 3000,  meta_anual: 36000 },

  // UPA Zanaga (placeholder)
  'ZAN-QT-PA-01':   { meta_mensal: 6750,  meta_anual: 81000 },
};

// ─── Metas qualitativas (meta_valor_qualit, meta_minima?, observacoes?) ──────
// código → { meta_valor_qualit, meta_minima?, meta_parcial?, unidade_medida?, observacoes? }
const METAS_QUAL = {
  // HMA — Qualitativos pontuáveis
  'HMA-QL-01': { meta_valor_qualit: 100.00 },
  'HMA-QL-02': { meta_valor_qualit: 100.00 },
  'HMA-QL-03': { meta_valor_qualit: 100.00 },
  'HMA-QL-04': { meta_valor_qualit: 100.00 },
  'HMA-QL-05': { meta_valor_qualit: 100.00 },
  'HMA-QL-06': { meta_valor_qualit: 90.00, meta_minima: 80.00 },    // ≥90%
  'HMA-QL-07': { meta_valor_qualit: 80.00 },                        // ≥80%
  'HMA-QL-08': { meta_valor_qualit: 100.00 },                       // informativo
  'HMA-QL-09': { meta_valor_qualit: 100.00 },
  'HMA-QL-10': { meta_valor_qualit: 100.00 },                       // informativo
  'HMA-QL-11': { meta_valor_qualit: 100.00 },
  'HMA-QL-12': { meta_valor_qualit: 100.00 },
  'HMA-QL-13': { meta_valor_qualit: 100.00 },
  'HMA-QL-14': { meta_valor_qualit: 100.00 },
  'HMA-QL-15': { meta_valor_qualit: 100.00 },
  'HMA-QL-16': { meta_valor_qualit: 100.00 },
  'HMA-QL-17': { meta_valor_qualit: 100.00 },
  'HMA-QL-18': { meta_valor_qualit: 85.00, meta_minima: 70.00 },    // ≥85%

  // HMA — Informativos qualidade na atenção
  'HMA-QL-19': { meta_valor_qualit: 15000.00, unidade_medida: 'atendimentos/mês' },
  'HMA-QL-20': { meta_valor_qualit: 90.00 },
  'HMA-QL-21': { meta_valor_qualit: 24.00,  unidade_medida: 'horas' },
  'HMA-QL-22': { meta_valor_qualit: 85.00 },
  'HMA-QL-23': { meta_valor_qualit: 85.00 },
  'HMA-QL-24': { meta_valor_qualit: 10.00,  unidade_medida: 'dias' },
  'HMA-QL-25': { meta_valor_qualit: 8.00,   unidade_medida: 'dias' },
  'HMA-QL-26': { meta_valor_qualit: 5.00,   unidade_medida: 'dias' },
  'HMA-QL-27': { meta_valor_qualit: 6.00 },
  'HMA-QL-28': { meta_valor_qualit: 20.00,  unidade_medida: 'dias' },
  'HMA-QL-29': {
    meta_valor_qualit: null,
    unidade_medida: '%',
    observacoes: 'Meta: redução mínima de 5% em relação ao ano anterior — Campanha Redução Cesarianas',
  },
  'HMA-QL-30': { meta_valor_qualit: 1.00 },
  'HMA-QL-31': { meta_valor_qualit: 1.00,   unidade_medida: 'casos/mês' },
  'HMA-QL-32': { meta_valor_qualit: 1.00 },

  // HMA — Transversal
  'HMA-QL-33': {
    meta_valor_qualit: 70.00,
    observacoes: 'HMA: mínimo 70% de procedimentos de alta complexidade; UNACON: mínimo 30%',
  },

  // UNACON — Qualitativos pontuáveis
  'UNA-QL-01': { meta_valor_qualit: 100.00 },
  'UNA-QL-02': { meta_valor_qualit: 100.00 },
  'UNA-QL-03': { meta_valor_qualit: 100.00 },
  'UNA-QL-04': { meta_valor_qualit: 100.00 },
  'UNA-QL-05': { meta_valor_qualit: 100.00 },
  'UNA-QL-06': { meta_valor_qualit: 100.00 },
  'UNA-QL-07': { meta_valor_qualit: 90.00, observacoes: 'Meta ≥90% (PDF exibiu "<90%" — interpretado como ≥90% por erro OCR)' },

  // UNACON — Informativos oncologia
  'UNA-QL-08': { meta_valor_qualit: 100.00,  unidade_medida: 'pacientes/mês' },
  'UNA-QL-09': { meta_valor_qualit: null,     unidade_medida: 'óbitos/mês',    observacoes: 'Monitoramento — sem meta numérica definida no aditivo' },
  'UNA-QL-10': { meta_valor_qualit: null,     observacoes: 'Monitoramento — incidência consolidada de óbitos' },
  'UNA-QL-11': { meta_valor_qualit: 5.00,     unidade_medida: 'consultas/mês', observacoes: 'Meta mínima: 5 novas consultas/mês' },
  'UNA-QL-12': { meta_valor_qualit: null,     observacoes: 'Monitoramento — sem meta numérica no aditivo' },
  'UNA-QL-13': { meta_valor_qualit: null,     observacoes: 'Monitoramento — sem meta numérica no aditivo' },
  'UNA-QL-14': { meta_valor_qualit: null,     observacoes: 'Monitoramento — incidência de internações durante tratamento' },
  'UNA-QL-15': { meta_valor_qualit: null,     observacoes: 'Monitoramento — razão consultas/sessões QT' },
  'UNA-QL-16': { meta_valor_qualit: 5.00,     observacoes: 'Meta: absenteísmo < 5%' },
  'UNA-QL-17': { meta_valor_qualit: null,     observacoes: 'Monitoramento — razão QT ambulatorial e domiciliar' },
  'UNA-QL-18': { meta_valor_qualit: 100.00,   observacoes: 'Meta: 100% dos pacientes iniciando tratamento em ≤60 dias' },
  'UNA-QL-19': { meta_valor_qualit: 5.00,     observacoes: 'Meta: eventos adversos QT < 5%' },
  'UNA-QL-20': { meta_valor_qualit: null,     observacoes: 'Monitoramento — razão mortalidade oncológica 1º ano / geral' },
  'UNA-QL-21': { meta_valor_qualit: 85.00 },

  // UPA Cillos — Qualitativos
  'CIL-QL-01': { meta_valor_qualit: 100.00 },
  'CIL-QL-02': { meta_valor_qualit: 100.00 },
  'CIL-QL-03': { meta_valor_qualit: 100.00 },
  'CIL-QL-04': { meta_valor_qualit: 100.00 },
  'CIL-QL-05': { meta_valor_qualit: 100.00 },
  'CIL-QL-06': { meta_valor_qualit: 100.00 },
  'CIL-QL-07': { meta_valor_qualit: 100.00 },
  'CIL-QL-08': { meta_valor_qualit: 100.00 },
  'CIL-QL-09': { meta_valor_qualit: 90.00, meta_minima: 80.00 },    // ≥90%

  // UPA Dona Rosa — Qualitativos pontuáveis
  'DR-QL-01': { meta_valor_qualit: 100.00 },
  'DR-QL-02': { meta_valor_qualit: 100.00 },
  'DR-QL-03': { meta_valor_qualit: 100.00 },
  'DR-QL-04': { meta_valor_qualit: 90.00, meta_minima: 80.00 },
  'DR-QL-05': { meta_valor_qualit: 100.00 },
  'DR-QL-06': { meta_valor_qualit: 100.00 },
  'DR-QL-07': { meta_valor_qualit: 100.00 },
  'DR-QL-08': { meta_valor_qualit: 80.00 },
  'DR-QL-09': { meta_valor_qualit: 100.00 },
  'DR-QL-10': { meta_valor_qualit: 100.00 },
  'DR-QL-11': { meta_valor_qualit: 100.00 },
  'DR-QL-12': { meta_valor_qualit: 100.00 },
  'DR-QL-13': { meta_valor_qualit: 100.00 },
  'DR-QL-14': { meta_valor_qualit: 100.00 },
  'DR-QL-15': { meta_valor_qualit: 4.00,  observacoes: 'Meta: % óbitos analisados < 4%' },

  // UPA Dona Rosa — Informativos
  'DR-QL-16': { meta_valor_qualit: 100.00 },
  'DR-QL-17': { meta_valor_qualit: 100.00 },
  'DR-QL-18': { meta_valor_qualit: 24.00, unidade_medida: 'horas' },
  'DR-QL-19': { meta_valor_qualit: 90.00 },
  'DR-QL-20': { meta_valor_qualit: 85.00 },

  // UPA Zanaga — placeholder
  'ZAN-QL-01': { meta_valor_qualit: null, observacoes: 'Indicadores a definir — aguardar PDF do contrato 002/2025' },
};

module.exports = {
  async up(queryInterface) {
    const [indicadores] = await queryInterface.sequelize.query(
      'SELECT indicador_id, codigo, tipo FROM tb_indicadores ORDER BY codigo'
    );

    const VIGENCIA = '2026-01-01';

    const metas = indicadores.map((ind) => {
      if (ind.tipo === 'quantitativo') {
        const d = METAS_QUANT[ind.codigo] || {};
        return {
          indicador_id: ind.indicador_id,
          versao: 1,
          vigencia_inicio: VIGENCIA,
          meta_mensal: d.meta_mensal ?? null,
          meta_anual: d.meta_anual ?? null,
          meta_valor_qualit: null,
          meta_minima: null,
          meta_parcial: null,
          unidade_medida: 'unidades',
          observacoes: d.observacoes ?? null,
        };
      }

      // qualitativo
      const d = METAS_QUAL[ind.codigo] || {};
      return {
        indicador_id: ind.indicador_id,
        versao: 1,
        vigencia_inicio: VIGENCIA,
        meta_mensal: null,
        meta_anual: null,
        meta_valor_qualit: d.meta_valor_qualit ?? null,
        meta_minima: d.meta_minima ?? null,
        meta_parcial: d.meta_parcial ?? null,
        unidade_medida: d.unidade_medida ?? '%',
        observacoes: d.observacoes ?? null,
      };
    });

    await queryInterface.bulkInsert('tb_metas', metas);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_metas', null, {});
  },
};
