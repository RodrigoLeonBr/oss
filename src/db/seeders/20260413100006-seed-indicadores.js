'use strict';

// ─── Unidades ────────────────────────────────────────────────────────────────
const U_HMA        = 'uuuu0001-0001-0001-0001-000000000001';
const U_UNACON     = 'uuuu0002-0002-0002-0002-000000000002';
const U_UPA_CILLOS = 'uuuu0003-0003-0003-0003-000000000003';
const U_UPA_DROSA  = 'uuuu0004-0004-0004-0004-000000000004';
const U_UPA_ZANAGA = 'uuuu0005-0005-0005-0005-000000000005';

// ─── Blocos HMA ──────────────────────────────────────────────────────────────
const B_HMA_PS    = 'bbbb0001-0001-0001-0001-000000000001';
const B_HMA_CC    = 'bbbb0002-0002-0002-0002-000000000002';
const B_HMA_PC    = 'bbbb0003-0003-0003-0003-000000000003';
const B_HMA_SADTI = 'bbbb0004-0004-0004-0004-000000000004';
const B_HMA_SADTE = 'bbbb0005-0005-0005-0005-000000000005';
const B_HMA_BS    = 'bbbb0006-0006-0006-0006-000000000006';
const B_HMA_HD    = 'bbbb0007-0007-0007-0007-000000000007';
const B_HMA_TXOC  = 'bbbb0008-0008-0008-0008-000000000008';

// ─── Blocos UNACON ────────────────────────────────────────────────────────────
const B_UNA_QT   = 'bbbb0009-0009-0009-0009-000000000009';
const B_UNA_PC   = 'bbbb0010-0010-0010-0010-000000000010';
const B_UNA_SADT = 'bbbb0011-0011-0011-0011-000000000011';

// ─── Blocos UPA Cillos ────────────────────────────────────────────────────────
const B_CIL_PA   = 'bbbb0012-0012-0012-0012-000000000012';
const B_CIL_SADT = 'bbbb0013-0013-0013-0013-000000000013';

// ─── Blocos UPA Dona Rosa ─────────────────────────────────────────────────────
const B_DR_PA   = 'bbbb0014-0014-0014-0014-000000000014';
const B_DR_SADT = 'bbbb0015-0015-0015-0015-000000000015';

// ─── Blocos UPA Zanaga ────────────────────────────────────────────────────────
const B_ZAN_PA = 'bbbb0016-0016-0016-0016-000000000016';

// ─── Gerador sequencial de IDs determinísticos ───────────────────────────────
let seq = 0;
const id = () => {
  seq++;
  const s = String(seq).padStart(4, '0');
  return `iiii${s}-${s}-${s}-${s}-${s.padStart(12, '0')}`;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const quant = (unidade_id, bloco_id, codigo, nome, fonte_dados = 'Manual') => ({
  indicador_id: id(),
  unidade_id,
  bloco_id,
  codigo,
  nome,
  tipo: 'quantitativo',
  grupo: 'auditoria_operacional',
  periodicidade: 'mensal',
  fonte_dados,
  peso_perc: 0.00,
  meta_tipo: 'maior_igual',
  unidade_medida: 'unidades/mês',
  tipo_implantacao: 0,
  versao: 1,
  ativo: 1,
});

const qual = (unidade_id, codigo, nome, grupo, peso_perc, meta_tipo = 'maior_igual', fonte = 'Manual', periodicidade = 'mensal') => ({
  indicador_id: id(),
  unidade_id,
  bloco_id: null,
  codigo,
  nome,
  tipo: 'qualitativo',
  grupo,
  periodicidade,
  fonte_dados: fonte,
  peso_perc,
  meta_tipo,
  unidade_medida: '%',
  tipo_implantacao: 0,
  versao: 1,
  ativo: 1,
});

// Indicador qualitativo informativo (sem pontuação — monitoramento)
const info = (unidade_id, codigo, nome, grupo, meta_tipo = 'maior_igual', unidade_medida = '%', periodicidade = 'mensal') => ({
  indicador_id: id(),
  unidade_id,
  bloco_id: null,
  codigo,
  nome,
  tipo: 'qualitativo',
  grupo,
  periodicidade,
  fonte_dados: 'Manual',
  peso_perc: 0.00,
  meta_tipo,
  unidade_medida,
  tipo_implantacao: 0,
  versao: 1,
  ativo: 1,
});

module.exports = {
  async up(queryInterface) {
    const indicadores = [

      // ═══════════════════════════════════════════════════════════════════════
      // HMA — INDICADORES QUANTITATIVOS (42 itens / 8 blocos)
      // 6º Termo Aditivo — Contrato 009/2023
      // ═══════════════════════════════════════════════════════════════════════

      // Pronto Socorro
      quant(U_HMA, B_HMA_PS, 'HMA-QT-PS-01', 'Atendimentos de Urgência/Emergência', 'Manual'),

      // Centro Cirúrgico (9 itens)
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-01', 'Cirurgias Vias Aéreas / Cabeça e Pescoço', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-02', 'Ap. Circulatório / Vascular / Fístula', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-03', 'Cirurgia Geral / Ap. Digestivo / Parede Abdominal', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-04', 'Cirurgia Sistema Osteomuscular', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-05', 'Cirurgia Aparelho Geniturinário', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-06', 'Sistema Nervoso Central e Periférico', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-07', 'Outras Cirurgias (Centro Cirúrgico)', 'Manual'),
      quant(U_HMA, B_HMA_CC, 'HMA-QT-CC-08', 'Partos e Nascimentos (inclusive cesárea)', 'Manual'),

      // Pequenas Cirurgias (6 itens)
      quant(U_HMA, B_HMA_PC, 'HMA-QT-PC-01', 'Pele Subcutânea e Mucosa', 'Manual'),
      quant(U_HMA, B_HMA_PC, 'HMA-QT-PC-02', 'Aparelho Geniturinário (Pequenas Cirurgias)', 'Manual'),
      quant(U_HMA, B_HMA_PC, 'HMA-QT-PC-03', 'Outras Cirurgias (Pequenas Cirurgias)', 'Manual'),
      quant(U_HMA, B_HMA_PC, 'HMA-QT-PC-04', 'Oftalmológica', 'Manual'),
      quant(U_HMA, B_HMA_PC, 'HMA-QT-PC-05', 'Enxerto', 'Manual'),
      quant(U_HMA, B_HMA_PC, 'HMA-QT-PC-06', 'Ap. Circulatório / Nefrologia (Pequenas Cirurgias)', 'Manual'),

      // SADT Interno — Referência (17 itens)
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-01', 'RX com e sem contraste', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-02', 'Endoscopia / Colonoscopia', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-03', 'Exames Laboratoriais (HMA/Hemodiálise/UNACON)', 'SIASUS'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-04', 'Tomografia com e sem contraste', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-05', 'Anátomo Patológico', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-06', 'Polipectomia', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-07', 'CPRE', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-08', 'Cintilografia Óssea (Linfocintilografia)', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-09', 'Cintilografia Miocárdio', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-10', 'Câmara Hiperbárica / Sessões', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-11', 'Ecotransesofágico', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-12', 'Biópsia Guiada por US', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-13', 'Ecocardiografia (Enfermaria)', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-14', 'Ecocardiografia Beira Leito (UTI)', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-15', 'Angiografia Cerebral', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-16', 'RNM com Contraste', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-17', 'RNM sem Contraste', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-18', 'Doppler Carótidas e Vertebrais', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-19', 'Eletroneuromiografia', 'Manual'),
      quant(U_HMA, B_HMA_SADTI, 'HMA-QT-SADTI-20', 'Adolfo Lutz', 'Manual'),

      // SADT Externo — Rede Pública (5 itens)
      quant(U_HMA, B_HMA_SADTE, 'HMA-QT-SADTE-01', 'Mamografia', 'SIASUS'),
      quant(U_HMA, B_HMA_SADTE, 'HMA-QT-SADTE-02', 'Ultrassonografia Externo', 'SIASUS'),
      quant(U_HMA, B_HMA_SADTE, 'HMA-QT-SADTE-03', 'Exames Laboratoriais – Gasometria', 'SIASUS'),
      quant(U_HMA, B_HMA_SADTE, 'HMA-QT-SADTE-04', 'Exames Laboratoriais – Espermograma', 'SIASUS'),
      quant(U_HMA, B_HMA_SADTE, 'HMA-QT-SADTE-05', 'Tomografia c/ Contraste (SADT Externo)', 'SIASUS'),

      // Banco de Sangue (1 item)
      quant(U_HMA, B_HMA_BS, 'HMA-QT-BS-01', 'Número de Doadores (Internos e Externos)', 'Manual'),

      // Hemodiálise (2 itens)
      quant(U_HMA, B_HMA_HD, 'HMA-QT-HD-01', 'Atendimento Ambulatorial Hemodiálise (Adulto/Pediátrico)', 'SIASUS'),
      quant(U_HMA, B_HMA_HD, 'HMA-QT-HD-02', 'Número de Pacientes em Hemodiálise', 'SIASUS'),

      // Taxa de Ocupação (6 itens — percentuais de leitos)
      { ...quant(U_HMA, B_HMA_TXOC, 'HMA-QT-TXOC-01', 'Taxa de Ocupação Cirúrgica (Pós Operatório)', 'Manual'), unidade_medida: '%', meta_tipo: 'maior_igual' },
      { ...quant(U_HMA, B_HMA_TXOC, 'HMA-QT-TXOC-02', 'Taxa de Ocupação Clínica Médica (Ala 1, Ala 3 e Obs.)', 'Manual'), unidade_medida: '%', meta_tipo: 'maior_igual' },
      { ...quant(U_HMA, B_HMA_TXOC, 'HMA-QT-TXOC-03', 'Taxa de Ocupação Ortopédica/Cirúrgica (Ala 2)', 'Manual'), unidade_medida: '%', meta_tipo: 'maior_igual' },
      { ...quant(U_HMA, B_HMA_TXOC, 'HMA-QT-TXOC-04', 'Taxa de Ocupação Pediatria', 'Manual'), unidade_medida: '%', meta_tipo: 'maior_igual' },
      { ...quant(U_HMA, B_HMA_TXOC, 'HMA-QT-TXOC-05', 'Taxa de Ocupação UTI Adulto (UTI I e UTI II)', 'Manual'), unidade_medida: '%', meta_tipo: 'maior_igual' },
      { ...quant(U_HMA, B_HMA_TXOC, 'HMA-QT-TXOC-06', 'Taxa de Ocupação UTI Neonatal', 'Manual'), unidade_medida: '%', meta_tipo: 'maior_igual' },


      // ═══════════════════════════════════════════════════════════════════════
      // HMA — INDICADORES QUALITATIVOS (33 itens)
      // Obj 1: Comissões (40%)
      // ═══════════════════════════════════════════════════════════════════════

      qual(U_HMA, 'HMA-QL-01', 'Comissão de Revisão de Prontuário',              'auditoria_operacional', 10.00),
      qual(U_HMA, 'HMA-QL-02', 'Comissão de Avaliação e Revisão de Óbitos',      'auditoria_operacional', 10.00),
      qual(U_HMA, 'HMA-QL-03', 'Comissão de Controle de Infecção Hospitalar (CCIH)', 'auditoria_operacional', 10.00),
      qual(U_HMA, 'HMA-QL-04', 'Núcleo de Segurança do Paciente (NSP)',          'auditoria_operacional', 10.00),

      // Obj 2: SAU (3%)
      qual(U_HMA, 'HMA-QL-05', 'Funcionamento do SAU',                           'auditoria_operacional', 3.00),

      // Obj 3: Ouvidoria (3%)
      qual(U_HMA, 'HMA-QL-06', 'Resolubilidade da Ouvidoria',                    'qualidade_atencao',     3.00, 'maior_igual'),

      // Obj 4: Educação Permanente (3% + informativo)
      qual(U_HMA, 'HMA-QL-07', 'Acompanhamento Plano de Educação Permanente',    'rh',                    3.00, 'maior_igual'),
      qual(U_HMA, 'HMA-QL-08', 'Atuação da CIPA',                                'rh',                    0.00),  // informativo

      // Obj 5: Prevenção Riscos (3% + informativo)
      qual(U_HMA, 'HMA-QL-09', 'Programa de Prevenção de Riscos Ambientais (PPRA)', 'rh',                  3.00),
      qual(U_HMA, 'HMA-QL-10', 'Programa de Controle Médico de Saúde Ocupacional (PCMSO)', 'rh',           0.00),  // informativo

      // Obj 6: CNES (3%)
      qual(U_HMA, 'HMA-QL-11', 'Informações Cadastrais Atualizadas (CNES)',      'auditoria_operacional', 3.00, 'igualdade', 'CNES'),

      // Obj 7: Sistemas Informatizados (3%)
      qual(U_HMA, 'HMA-QL-12', 'Entrega Relatórios aos Órgãos Fiscalizadores (SMS)', 'auditoria_operacional', 3.00),

      // Obj 8: Registros de Classe (3%)
      qual(U_HMA, 'HMA-QL-13', 'Efetividade dos Registros junto aos Órgãos de Classe', 'auditoria_operacional', 3.00),

      // Obj 9: POPs (3%)
      qual(U_HMA, 'HMA-QL-14', 'Cronograma Anual dos POPs',                      'auditoria_operacional', 3.00),

      // Obj 10: GTH (5%)
      qual(U_HMA, 'HMA-QL-15', 'Formalização GTH – HumanizaSUS',                 'auditoria_operacional', 5.00),

      // Obj 11: Execução Financeira (9%)
      qual(U_HMA, 'HMA-QL-16', 'Entrega Relatórios e Prestações de Contas',      'auditoria_operacional', 9.00),

      // Obj 12: Documentação Regulatória (9%)
      qual(U_HMA, 'HMA-QL-17', 'Documentação Obrigatória para Funcionamento',    'auditoria_operacional', 9.00),

      // Obj 13: Qualidade na Atenção — 1 pontuável + 15 informativos
      qual(U_HMA, 'HMA-QL-18', 'Percentual de Óbitos Institucionais Analisados', 'qualidade_atencao',     5.00, 'maior_igual'),

      info(U_HMA, 'HMA-QL-19', 'Nº de Acolhimentos com Classificação de Risco',  'qualidade_atencao', 'maior_igual', 'atendimentos/mês'),
      info(U_HMA, 'HMA-QL-20', 'Taxa de Acolhimento com Classificação de Risco', 'qualidade_atencao', 'maior_igual', '%'),
      info(U_HMA, 'HMA-QL-21', 'Média de Permanência na Observação',             'qualidade_atencao', 'menor_igual', 'horas'),
      info(U_HMA, 'HMA-QL-22', 'Taxa de Ocupação Geral',                         'qualidade_atencao', 'maior_igual', '%'),
      info(U_HMA, 'HMA-QL-23', 'Taxa de Satisfação do Usuário (HMA)',            'qualidade_atencao', 'maior_igual', '%'),
      info(U_HMA, 'HMA-QL-24', 'Média de Permanência UTI Adulto',                'qualidade_atencao', 'menor_igual', 'dias'),
      info(U_HMA, 'HMA-QL-25', 'Média de Permanência Clínica Médica',            'qualidade_atencao', 'menor_igual', 'dias'),
      info(U_HMA, 'HMA-QL-26', 'Média de Permanência Clínica Cirúrgica',         'qualidade_atencao', 'menor_igual', 'dias'),
      info(U_HMA, 'HMA-QL-27', 'Taxa de Mortalidade Institucional',              'qualidade_atencao', 'menor_igual', '%'),
      info(U_HMA, 'HMA-QL-28', 'Média de Permanência UTI Neonatal',              'qualidade_atencao', 'menor_igual', 'dias'),
      info(U_HMA, 'HMA-QL-29', 'Taxa de Cesarianas — Campanha Redução',          'qualidade_atencao', 'menor_igual', '%'),
      info(U_HMA, 'HMA-QL-30', 'Taxa Atendimentos no Tempo Preconizado (Classif. Risco)', 'qualidade_atencao', 'maior_igual', '%'),
      info(U_HMA, 'HMA-QL-31', 'Incidência de Pacientes com UPP',                'qualidade_atencao', 'menor_igual', 'casos/mês'),
      info(U_HMA, 'HMA-QL-32', 'Taxa de Curas ou Melhora de Feridas',            'qualidade_atencao', 'maior_igual', '%'),

      // Obj 14: Complexidade Cirúrgica — transversal (2%)
      qual(U_HMA, 'HMA-QL-33', 'Complexidade de Procedimentos Cirúrgicos HMA e UNACON', 'transversal', 2.00, 'maior_igual', 'Manual', 'trimestral'),


      // ═══════════════════════════════════════════════════════════════════════
      // UNACON — INDICADORES QUANTITATIVOS (6 itens / 3 blocos)
      // ═══════════════════════════════════════════════════════════════════════

      quant(U_UNACON, B_UNA_QT,   'UNA-QT-QT-01', 'Sessões de Quimioterapia',                      'SIASUS'),
      quant(U_UNACON, B_UNA_PC,   'UNA-QT-PC-01', 'Cirurgias Oncológicas (Baixa/Média Complexidade)', 'Manual'),
      quant(U_UNACON, B_UNA_PC,   'UNA-QT-PC-02', 'Cirurgia Reparadora',                           'Manual'),
      quant(U_UNACON, B_UNA_PC,   'UNA-QT-PC-03', 'Pequena Cirurgia UNACON',                       'Manual'),
      quant(U_UNACON, B_UNA_SADT, 'UNA-QT-SADT-01', 'Ultrassonografia (UNACON)',                   'SIASUS'),
      quant(U_UNACON, B_UNA_SADT, 'UNA-QT-SADT-02', 'Tomografia com Contraste (UNACON)',           'Manual'),


      // ═══════════════════════════════════════════════════════════════════════
      // UNACON — INDICADORES QUALITATIVOS (21 itens)
      // 7 pontuáveis (6×10% + 40% aderência = 100%)
      // 14 informativos grupo "Qualidade Tratamento Oncológico"
      // ═══════════════════════════════════════════════════════════════════════

      // Pontuáveis
      qual(U_UNACON, 'UNA-QL-01', 'Informações Cadastrais Atualizadas — CNES (UNACON)', 'auditoria_operacional', 10.00, 'igualdade', 'CNES'),
      qual(U_UNACON, 'UNA-QL-02', 'Entrega Relatórios SMS (UNACON)',                 'auditoria_operacional', 10.00),
      qual(U_UNACON, 'UNA-QL-03', 'Efetividade dos Registros — Órgãos de Classe (UNACON)', 'auditoria_operacional', 10.00),
      qual(U_UNACON, 'UNA-QL-04', 'Cronograma Anual dos POPs (UNACON)',             'auditoria_operacional', 10.00),
      qual(U_UNACON, 'UNA-QL-05', 'Entrega Relatórios e Prestações de Contas (UNACON)', 'auditoria_operacional', 10.00),
      qual(U_UNACON, 'UNA-QL-06', 'Documentação Obrigatória para Funcionamento (UNACON)', 'auditoria_operacional', 10.00),
      // Taxa de aderência: PDF mostra "<90%" — interpretado como "≥90%" (erro OCR)
      qual(U_UNACON, 'UNA-QL-07', 'Taxa de Aderência às Diretrizes Clínicas Oncológicas', 'qualidade_atencao', 40.00, 'maior_igual'),

      // Informativos — Qualidade Tratamento Oncológico
      info(U_UNACON, 'UNA-QL-08', 'Nº de Pacientes Atendidos na UNACON',         'qualidade_atencao', 'maior_igual', 'pacientes/mês'),
      info(U_UNACON, 'UNA-QL-09', 'Nº de Óbitos no Serviço Oncológico',          'qualidade_atencao', 'menor_igual', 'óbitos/mês'),
      info(U_UNACON, 'UNA-QL-10', 'Incidência Consolidada de Óbitos',            'qualidade_atencao', 'menor_igual', '%'),
      info(U_UNACON, 'UNA-QL-11', 'Nº de Novas Consultas Oncológicas',           'qualidade_atencao', 'maior_igual', 'consultas/mês'),
      info(U_UNACON, 'UNA-QL-12', 'Taxa de Realização de Atenção Nutricional',   'qualidade_atencao', 'maior_igual', '%'),
      info(U_UNACON, 'UNA-QL-13', 'Taxa de Realização de Atenção Psicológica',   'qualidade_atencao', 'maior_igual', '%'),
      info(U_UNACON, 'UNA-QL-14', 'Incidência de Pacientes Internados Durante Tratamento', 'qualidade_atencao', 'menor_igual', '%'),
      info(U_UNACON, 'UNA-QL-15', 'Razão Consultas Oncologista × Sessões QT',    'qualidade_atencao', 'maior_igual', 'razão'),
      info(U_UNACON, 'UNA-QL-16', '% Absenteísmo nas Sessões de Quimioterapia',  'qualidade_atencao', 'menor_igual', '%'),
      info(U_UNACON, 'UNA-QL-17', 'Razão Tratamento QT Ambulatorial e Domiciliar', 'qualidade_atencao', 'maior_igual', 'razão'),
      info(U_UNACON, 'UNA-QL-18', '% Pacientes que Iniciaram Tratamento em ≤60 dias', 'qualidade_atencao', 'maior_igual', '%'),
      info(U_UNACON, 'UNA-QL-19', '% Eventos Adversos Relacionados à Infusão QT', 'qualidade_atencao', 'menor_igual', '%'),
      info(U_UNACON, 'UNA-QL-20', 'Razão Taxa Mortalidade Oncológica 1º Ano / Geral', 'qualidade_atencao', 'menor_igual', 'razão'),
      info(U_UNACON, 'UNA-QL-21', 'Taxa de Satisfação do Usuário UNACON',        'qualidade_atencao', 'maior_igual', '%'),


      // ═══════════════════════════════════════════════════════════════════════
      // UPA CILLOS — INDICADORES QUANTITATIVOS (3 itens / 2 blocos)
      // ═══════════════════════════════════════════════════════════════════════

      quant(U_UPA_CILLOS, B_CIL_PA,   'CIL-QT-PA-01',   'Atendimento Médico (UPA Cillos)',     'Manual'),
      quant(U_UPA_CILLOS, B_CIL_SADT, 'CIL-QT-SADT-01', 'RX sem Contraste (UPA Cillos)',       'Manual'),
      quant(U_UPA_CILLOS, B_CIL_SADT, 'CIL-QT-SADT-02', 'Exames Laboratoriais (UPA Cillos)',   'SIASUS'),


      // ═══════════════════════════════════════════════════════════════════════
      // UPA CILLOS — INDICADORES QUALITATIVOS (9 itens — todos pontuáveis, total 100%)
      // 6º Aditivo — Contrato 009/2023
      // ═══════════════════════════════════════════════════════════════════════

      qual(U_UPA_CILLOS, 'CIL-QL-01', 'Funcionamento do SAU (UPA Cillos)',                'auditoria_operacional', 10.00),
      qual(U_UPA_CILLOS, 'CIL-QL-02', 'Comissão de Revisão de Prontuário (UPA Cillos)',   'auditoria_operacional', 20.00),
      qual(U_UPA_CILLOS, 'CIL-QL-03', 'Comissão de Avaliação e Revisão de Óbitos (UPA Cillos)', 'auditoria_operacional', 20.00),
      qual(U_UPA_CILLOS, 'CIL-QL-04', 'Informações Cadastrais Atualizadas — CNES (UPA Cillos)', 'auditoria_operacional', 10.00, 'igualdade', 'CNES'),
      qual(U_UPA_CILLOS, 'CIL-QL-05', 'Entrega Relatórios SMS (UPA Cillos)',               'auditoria_operacional', 10.00),
      qual(U_UPA_CILLOS, 'CIL-QL-06', 'Efetividade dos Registros — Órgãos de Classe (UPA Cillos)', 'auditoria_operacional', 9.00),
      qual(U_UPA_CILLOS, 'CIL-QL-07', 'Entrega Relatórios e Prestações de Contas (UPA Cillos)', 'auditoria_operacional', 9.00),
      qual(U_UPA_CILLOS, 'CIL-QL-08', 'Manutenção Documentação Regulatória (UPA Cillos)', 'auditoria_operacional', 9.00),
      qual(U_UPA_CILLOS, 'CIL-QL-09', 'Resolubilidade da Ouvidoria (UPA Cillos)',          'qualidade_atencao',     3.00, 'maior_igual'),


      // ═══════════════════════════════════════════════════════════════════════
      // UPA DONA ROSA — INDICADORES QUANTITATIVOS (3 itens / 2 blocos)
      // 2º Termo Aditivo — Contrato 066/2024
      // ═══════════════════════════════════════════════════════════════════════

      quant(U_UPA_DROSA, B_DR_PA,   'DR-QT-PA-01',   'Atendimentos Médicos (UPA Dona Rosa)',  'Manual'),
      quant(U_UPA_DROSA, B_DR_SADT, 'DR-QT-SADT-01', 'Raio X sem Contraste (UPA Dona Rosa)',  'Manual'),
      quant(U_UPA_DROSA, B_DR_SADT, 'DR-QT-SADT-02', 'Exames Laboratoriais (UPA Dona Rosa)',  'SIASUS'),
      // Nota: "TOTAL SADT (RX + Lab)" omitido — é métrica derivada, não indicador autônomo


      // ═══════════════════════════════════════════════════════════════════════
      // UPA DONA ROSA — INDICADORES QUALITATIVOS (15 pontuáveis, total 100%)
      // Contrato 066/2024 — 2º Termo Aditivo
      // ═══════════════════════════════════════════════════════════════════════

      qual(U_UPA_DROSA, 'DR-QL-01', 'Comissão de Revisão de Prontuário (UPA Dona Rosa)',       'auditoria_operacional', 10.00),
      qual(U_UPA_DROSA, 'DR-QL-02', 'Comissão de Avaliação e Revisão de Óbitos (UPA Dona Rosa)', 'auditoria_operacional', 5.00),
      qual(U_UPA_DROSA, 'DR-QL-03', 'Funcionamento do SAU (UPA Dona Rosa)',                    'auditoria_operacional', 10.00),
      qual(U_UPA_DROSA, 'DR-QL-04', 'Resolubilidade da Ouvidoria (UPA Dona Rosa)',             'qualidade_atencao',     5.00, 'maior_igual'),
      qual(U_UPA_DROSA, 'DR-QL-05', 'Atuação da CIPA (UPA Dona Rosa)',                         'rh',                    5.00),
      qual(U_UPA_DROSA, 'DR-QL-06', 'Elaboração e Implantação PCMSO (UPA Dona Rosa)',           'rh',                    0.00),  // informativo
      qual(U_UPA_DROSA, 'DR-QL-07', 'Informações Cadastrais Atualizadas — CNES (UPA Dona Rosa)', 'auditoria_operacional', 10.00, 'igualdade', 'CNES'),
      qual(U_UPA_DROSA, 'DR-QL-08', 'Acompanhamento Plano de Educação Permanente (UPA Dona Rosa)', 'rh',                5.00, 'maior_igual'),
      qual(U_UPA_DROSA, 'DR-QL-09', 'Transmissão de Dados Sinan — Vigilância Epidemiológica',  'auditoria_operacional', 5.00),
      qual(U_UPA_DROSA, 'DR-QL-10', 'Entrega Relatórios aos Órgãos Fiscalizadores SMS (SIA-SUS)', 'auditoria_operacional', 10.00),
      qual(U_UPA_DROSA, 'DR-QL-11', 'Efetividade dos Registros — Órgãos de Classe (UPA Dona Rosa)', 'auditoria_operacional', 5.00),
      qual(U_UPA_DROSA, 'DR-QL-12', 'Cronograma Anual dos POPs (UPA Dona Rosa)',               'auditoria_operacional', 10.00),
      qual(U_UPA_DROSA, 'DR-QL-13', 'Formalização GTH – HumanizaSUS (UPA Dona Rosa)',          'auditoria_operacional', 5.00),
      qual(U_UPA_DROSA, 'DR-QL-14', 'Entrega Relatórios e Prestações de Contas (UPA Dona Rosa)', 'auditoria_operacional', 10.00),
      qual(U_UPA_DROSA, 'DR-QL-15', '% Óbitos Institucionais Analisados (UPA Dona Rosa)',      'qualidade_atencao',     5.00, 'menor_igual'),

      // Informativos UPA Dona Rosa
      info(U_UPA_DROSA, 'DR-QL-16', 'Documentação Regulada conforme Manual SMS',    'auditoria_operacional', 'maior_igual', '%'),
      info(U_UPA_DROSA, 'DR-QL-17', 'Documentação Regulatória (UPA Dona Rosa)',     'auditoria_operacional', 'maior_igual', '%'),
      info(U_UPA_DROSA, 'DR-QL-18', 'Média de Permanência na Observação (Dona Rosa)', 'qualidade_atencao', 'menor_igual', 'horas'),
      info(U_UPA_DROSA, 'DR-QL-19', 'Taxa de Acolhimento com Classificação de Risco (Dona Rosa)', 'qualidade_atencao', 'maior_igual', '%'),
      info(U_UPA_DROSA, 'DR-QL-20', 'Taxa de Satisfação do Usuário (UPA Dona Rosa)', 'qualidade_atencao', 'maior_igual', '%'),


      // ═══════════════════════════════════════════════════════════════════════
      // UPA ZANAGA — placeholder (sem PDF de indicadores)
      // ═══════════════════════════════════════════════════════════════════════

      quant(U_UPA_ZANAGA, B_ZAN_PA, 'ZAN-QT-PA-01', 'Atendimentos Médicos (UPA Zanaga)', 'Manual'),
      qual(U_UPA_ZANAGA,  'ZAN-QL-01', 'Indicadores Qualitativos (UPA Zanaga — a definir)', 'auditoria_operacional', 0.00),
    ];

    await queryInterface.bulkInsert('tb_indicadores', indicadores);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_indicadores', null, {});
  },
};
