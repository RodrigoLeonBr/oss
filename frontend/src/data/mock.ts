import type {
  Contrato, Unidade, BlocoProducao, Indicador, Meta,
  AcompanhamentoMensal,
  RepasseMensal, Usuario, DashboardResumo, Oss,
} from '../types'

// --- OSS ---
export const mockOss: Oss[] = [
  { oss_id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis', cnpj: '45.352.327/0001-55', tipo_org: 'Fundacao', email: 'contato@scmc.org.br', site: 'https://www.scmc.org.br', ativa: true },
  { oss_id: '22222222-2222-2222-2222-222222222222', nome: 'Instituto Nacional de Desenvolvimento Social e Humano', cnpj: '08.922.123/0001-00', tipo_org: 'Instituto', email: 'contato@indsh.org.br', site: 'https://www.indsh.org.br', ativa: true },
]

// --- CONTRATOS ---
export const mockContratos: Contrato[] = [
  {
    contrato_id: 'cccc0001-0001-0001-0001-000000000001', oss_id: '11111111-1111-1111-1111-111111111111',
    numero: 'CG-001/2024', tipo: 'contrato_gestao', data_inicio: '2024-01-01', data_fim: '2028-12-31',
    valor_mensal_base: 10000000, valor_anual: 120000000, perc_fixo: 90, perc_variavel: 10,
    modelo_desconto_qual: 'flat', numero_aditivos: 0, status: 'Ativo', observacoes: 'HMA - Hospital Municipal de Americana',
  },
  {
    contrato_id: 'cccc0002-0002-0002-0002-000000000002', oss_id: '11111111-1111-1111-1111-111111111111',
    numero: 'CG-002/2024', tipo: 'contrato_gestao', data_inicio: '2024-01-01', data_fim: '2028-12-31',
    valor_mensal_base: 3500000, valor_anual: 42000000, perc_fixo: 90, perc_variavel: 10,
    modelo_desconto_qual: 'ponderado', numero_aditivos: 0, status: 'Ativo', observacoes: 'UNACON',
  },
  {
    contrato_id: 'cccc0003-0003-0003-0003-000000000003', oss_id: '22222222-2222-2222-2222-222222222222',
    numero: 'CG-003/2025', tipo: 'contrato_gestao', data_inicio: '2025-01-01', data_fim: '2029-12-31',
    valor_mensal_base: 7200000, valor_anual: 86400000, perc_fixo: 85, perc_variavel: 15,
    modelo_desconto_qual: 'flat', numero_aditivos: 0, status: 'Ativo', observacoes: 'UPAs (3 unidades)',
  },
]

// --- UNIDADES ---
export const mockUnidades: Unidade[] = [
  { unidade_id: 'uuuu0001-0001-0001-0001-000000000001', contrato_id: 'cccc0001-0001-0001-0001-000000000001', nome: 'Hospital Municipal Dr. Waldemar Tebaldi', sigla: 'HMA', tipo: 'hospital', cnes: '2080125', porte: 'Grande Porte', capacidade_leitos: 222, valor_mensal_unidade: 10000000, percentual_peso: 100, ativa: true },
  { unidade_id: 'uuuu0002-0002-0002-0002-000000000002', contrato_id: 'cccc0002-0002-0002-0002-000000000002', nome: 'UNACON', sigla: 'UNACON', tipo: 'unacon', cnes: '2080126', porte: 'Especializado', capacidade_leitos: 30, valor_mensal_unidade: 3500000, percentual_peso: 100, ativa: true },
  { unidade_id: 'uuuu0003-0003-0003-0003-000000000003', contrato_id: 'cccc0003-0003-0003-0003-000000000003', nome: 'UPA 24h Cillos', sigla: 'UPA-CIL', tipo: 'upa', cnes: '7654321', porte: 'Porte III', capacidade_leitos: 12, valor_mensal_unidade: 2400000, percentual_peso: 33.33, ativa: true },
  { unidade_id: 'uuuu0004-0004-0004-0004-000000000004', contrato_id: 'cccc0003-0003-0003-0003-000000000003', nome: 'UPA 24h Dona Rosa', sigla: 'UPA-DR', tipo: 'upa', cnes: '7654322', porte: 'Porte III', capacidade_leitos: 12, valor_mensal_unidade: 2400000, percentual_peso: 33.34, ativa: true },
  { unidade_id: 'uuuu0005-0005-0005-0005-000000000005', contrato_id: 'cccc0003-0003-0003-0003-000000000003', nome: 'UPA 24h Zanaga', sigla: 'UPA-ZAN', tipo: 'upa', cnes: '7654323', porte: 'Porte III', capacidade_leitos: 10, valor_mensal_unidade: 2400000, percentual_peso: 33.33, ativa: true },
]

// --- BLOCOS ---
export const mockBlocos: BlocoProducao[] = [
  { bloco_id: 'bbbb0001-0001-0001-0001-000000000001', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-URG', nome: 'Urgência e Emergência', valor_mensal_alocado: 3000000, percentual_peso_bloco: 30, ativo: true },
  { bloco_id: 'bbbb0002-0002-0002-0002-000000000002', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-INT', nome: 'Internação', valor_mensal_alocado: 2500000, percentual_peso_bloco: 25, ativo: true },
  { bloco_id: 'bbbb0003-0003-0003-0003-000000000003', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-CIR', nome: 'Cirurgias', valor_mensal_alocado: 2000000, percentual_peso_bloco: 20, ativo: true },
  { bloco_id: 'bbbb0004-0004-0004-0004-000000000004', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-SADT', nome: 'SADT e Exames', valor_mensal_alocado: 1500000, percentual_peso_bloco: 15, ativo: true },
  { bloco_id: 'bbbb0005-0005-0005-0005-000000000005', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-AMB', nome: 'Ambulatório', valor_mensal_alocado: 1000000, percentual_peso_bloco: 10, ativo: true },
  { bloco_id: 'bbbb0006-0006-0006-0006-000000000006', unidade_id: 'uuuu0002-0002-0002-0002-000000000002', codigo: 'UNA-QT', nome: 'Quimioterapia', valor_mensal_alocado: 1500000, percentual_peso_bloco: 42.86, ativo: true },
  { bloco_id: 'bbbb0007-0007-0007-0007-000000000007', unidade_id: 'uuuu0002-0002-0002-0002-000000000002', codigo: 'UNA-RT', nome: 'Radioterapia', valor_mensal_alocado: 1000000, percentual_peso_bloco: 28.57, ativo: true },
  { bloco_id: 'bbbb0009-0009-0009-0009-000000000009', unidade_id: 'uuuu0003-0003-0003-0003-000000000003', codigo: 'CIL-ATD', nome: 'Atendimentos UPA Cillos', valor_mensal_alocado: 2400000, percentual_peso_bloco: 100, ativo: true },
  { bloco_id: 'bbbb0010-0010-0010-0010-000000000010', unidade_id: 'uuuu0004-0004-0004-0004-000000000004', codigo: 'DR-ATD', nome: 'Atendimentos UPA Dona Rosa', valor_mensal_alocado: 2400000, percentual_peso_bloco: 100, ativo: true },
  { bloco_id: 'bbbb0011-0011-0011-0011-000000000011', unidade_id: 'uuuu0005-0005-0005-0005-000000000005', codigo: 'ZAN-ATD', nome: 'Atendimentos UPA Zanaga', valor_mensal_alocado: 2400000, percentual_peso_bloco: 100, ativo: true },
]

// --- INDICADORES (representativos) ---
export const mockIndicadores: Indicador[] = [
  { indicador_id: 'i001', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', bloco_id: 'bbbb0001-0001-0001-0001-000000000001', codigo: 'HMA-AO-01', nome: 'Atendimentos Urgência', tipo: 'quantitativo', grupo: 'auditoria_operacional', periodicidade: 'mensal', fonte_dados: 'Manual', peso_perc: 15, meta_tipo: 'maior_igual', unidade_medida: 'atendimentos/mês', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i002', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', bloco_id: 'bbbb0002-0002-0002-0002-000000000002', codigo: 'HMA-AO-02', nome: 'Internações Clínica Médica', tipo: 'quantitativo', grupo: 'auditoria_operacional', periodicidade: 'mensal', fonte_dados: 'SIH', peso_perc: 12.5, meta_tipo: 'maior_igual', unidade_medida: 'internações/mês', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i006', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-QA-01', nome: 'Taxa de Óbitos Analisados', tipo: 'qualitativo', grupo: 'qualidade_atencao', periodicidade: 'mensal', fonte_dados: 'Prontuario', peso_perc: 10, meta_tipo: 'maior_igual', unidade_medida: '%', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i007', unidade_id: 'uuuu0001-0001-0001-0001-000000000001', codigo: 'HMA-QA-02', nome: 'Taxa de Infecção Hospitalar', tipo: 'qualitativo', grupo: 'qualidade_atencao', periodicidade: 'mensal', fonte_dados: 'Prontuario', peso_perc: 10, meta_tipo: 'menor_igual', unidade_medida: '%', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i014', unidade_id: 'uuuu0002-0002-0002-0002-000000000002', bloco_id: 'bbbb0006-0006-0006-0006-000000000006', codigo: 'UNA-AO-01', nome: 'Sessões de Quimioterapia', tipo: 'quantitativo', grupo: 'auditoria_operacional', periodicidade: 'mensal', fonte_dados: 'SIASUS', peso_perc: 25, meta_tipo: 'maior_igual', unidade_medida: 'sessões/mês', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i020', unidade_id: 'uuuu0003-0003-0003-0003-000000000003', bloco_id: 'bbbb0009-0009-0009-0009-000000000009', codigo: 'CIL-AO-01', nome: 'Atendimentos Urgência UPA Cillos', tipo: 'quantitativo', grupo: 'auditoria_operacional', periodicidade: 'mensal', fonte_dados: 'Manual', peso_perc: 40, meta_tipo: 'maior_igual', unidade_medida: 'atendimentos/mês', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i023', unidade_id: 'uuuu0004-0004-0004-0004-000000000004', bloco_id: 'bbbb0010-0010-0010-0010-000000000010', codigo: 'DR-AO-01', nome: 'Atendimentos Urgência UPA Dona Rosa', tipo: 'quantitativo', grupo: 'auditoria_operacional', periodicidade: 'mensal', fonte_dados: 'Manual', peso_perc: 40, meta_tipo: 'maior_igual', unidade_medida: 'atendimentos/mês', versao: 1, ativo: true, tipo_implantacao: false },
  { indicador_id: 'i026', unidade_id: 'uuuu0005-0005-0005-0005-000000000005', bloco_id: 'bbbb0011-0011-0011-0011-000000000011', codigo: 'ZAN-AO-01', nome: 'Atendimentos Urgência UPA Zanaga', tipo: 'quantitativo', grupo: 'auditoria_operacional', periodicidade: 'mensal', fonte_dados: 'Manual', peso_perc: 40, meta_tipo: 'maior_igual', unidade_medida: 'atendimentos/mês', versao: 1, ativo: true, tipo_implantacao: false },
]

// --- METAS ---
export const mockMetas: Meta[] = [
  { meta_id: 'm001', indicador_id: 'i001', versao: 1, vigencia_inicio: '2024-01-01', meta_mensal: 12000, meta_anual: 144000, unidade_medida: 'atendimentos' },
  { meta_id: 'm002', indicador_id: 'i002', versao: 1, vigencia_inicio: '2024-01-01', meta_mensal: 800, meta_anual: 9600, unidade_medida: 'internações' },
  { meta_id: 'm006', indicador_id: 'i006', versao: 1, vigencia_inicio: '2024-01-01', meta_valor_qualit: 100, meta_minima: 80, unidade_medida: '%' },
  { meta_id: 'm007', indicador_id: 'i007', versao: 1, vigencia_inicio: '2024-01-01', meta_valor_qualit: 5, unidade_medida: '%' },
  { meta_id: 'm014', indicador_id: 'i014', versao: 1, vigencia_inicio: '2024-01-01', meta_mensal: 600, meta_anual: 7200, unidade_medida: 'sessões' },
  { meta_id: 'm020', indicador_id: 'i020', versao: 1, vigencia_inicio: '2025-01-01', meta_mensal: 8000, meta_anual: 96000, unidade_medida: 'atendimentos' },
  { meta_id: 'm023', indicador_id: 'i023', versao: 1, vigencia_inicio: '2025-01-01', meta_mensal: 8000, meta_anual: 96000, unidade_medida: 'atendimentos' },
  { meta_id: 'm026', indicador_id: 'i026', versao: 1, vigencia_inicio: '2025-01-01', meta_mensal: 7000, meta_anual: 84000, unidade_medida: 'atendimentos' },
]

// --- ACOMPANHAMENTOS ---
export const mockAcompanhamentos: AcompanhamentoMensal[] = [
  { acomp_id: 'a001', indicador_id: 'i001', meta_id: 'm001', mes_referencia: '2026-03-01', meta_vigente_mensal: 12000, valor_realizado: 12500, percentual_cumprimento: 104.2, status_cumprimento: 'cumprido', faixa_producao: 'acima_meta', status_aprovacao: 'aprovado', desconto_estimado: 0 },
  { acomp_id: 'a002', indicador_id: 'i002', meta_id: 'm002', mes_referencia: '2026-03-01', meta_vigente_mensal: 800, valor_realizado: 720, percentual_cumprimento: 90, status_cumprimento: 'parcial', faixa_producao: 'entre_85_100', status_aprovacao: 'aprovado', desconto_estimado: 0 },
  { acomp_id: 'a003', indicador_id: 'i006', meta_id: 'm006', mes_referencia: '2026-03-01', meta_vigente_qualit: 100, valor_realizado: 85, percentual_cumprimento: 85, status_cumprimento: 'parcial', status_aprovacao: 'aprovado', desconto_estimado: 0 },
  { acomp_id: 'a004', indicador_id: 'i007', meta_id: 'm007', mes_referencia: '2026-03-01', meta_vigente_qualit: 5, valor_realizado: 6.2, percentual_cumprimento: 124, status_cumprimento: 'nao_cumprido', status_aprovacao: 'aprovado', desconto_estimado: 10000 },
  { acomp_id: 'a005', indicador_id: 'i014', meta_id: 'm014', mes_referencia: '2026-03-01', meta_vigente_mensal: 600, valor_realizado: 580, percentual_cumprimento: 96.7, status_cumprimento: 'parcial', faixa_producao: 'entre_85_100', status_aprovacao: 'submetido', desconto_estimado: 0 },
  { acomp_id: 'a006', indicador_id: 'i020', meta_id: 'm020', mes_referencia: '2026-03-01', meta_vigente_mensal: 8000, valor_realizado: 8200, percentual_cumprimento: 102.5, status_cumprimento: 'cumprido', faixa_producao: 'acima_meta', status_aprovacao: 'aprovado', desconto_estimado: 0 },
  { acomp_id: 'a007', indicador_id: 'i023', meta_id: 'm023', mes_referencia: '2026-03-01', meta_vigente_mensal: 8000, valor_realizado: 5500, percentual_cumprimento: 68.8, status_cumprimento: 'nao_cumprido', faixa_producao: 'abaixo_70', status_aprovacao: 'aprovado', desconto_estimado: 720000 },
]

// --- REPASSE MENSAL (exemplo março/2026 contrato HMA) ---
export const mockRepasse: RepasseMensal = {
  repasse_id: 'rep001', contrato_id: 'cccc0001-0001-0001-0001-000000000001', mes_referencia: '2026-03-01',
  valor_mensal_base: 10000000, parcela_fixa: 9000000, parcela_variavel: 1000000,
  desconto_producao_total: 0, desconto_qualidade_total: 10000,
  desconto_total: 10000, repasse_final: 9990000, percentual_retido: 0.1,
  status: 'calculado',
  descontos_bloco: [],
  descontos_indicador: [
    { desc_ind_id: 'di001', repasse_id: 'rep001', acomp_id: 'a004', indicador_id: 'i007', mes_referencia: '2026-03-01', modelo_desconto: 'flat', peso_indicador: 10, percentual_desconto: 1, valor_desconto: 10000, auditado: false },
  ],
}

// --- USUARIOS MOCK ---
export const mockUsuarios: Usuario[] = [
  { usuario_id: 'aaaa0001-0001-0001-0001-000000000001', nome: 'Administrador Geral', email: 'admin@americana.sp.gov.br', perfil: 'admin', ativo: true },
  { usuario_id: 'aaaa0002-0002-0002-0002-000000000002', nome: 'Gestor SMS', email: 'gestor@sms.americana.sp.gov.br', perfil: 'gestor_sms', ativo: true },
  { usuario_id: 'aaaa0003-0003-0003-0003-000000000003', nome: 'Auditora SMS', email: 'auditora@sms.americana.sp.gov.br', perfil: 'auditora', ativo: true },
  { usuario_id: 'aaaa0004-0004-0004-0004-000000000004', nome: 'Conselheiro CMS', email: 'cms@americana.sp.gov.br', perfil: 'conselheiro_cms', ativo: true },
  { usuario_id: 'aaaa0005-0005-0005-0005-000000000005', nome: 'Operador SCMC', email: 'operador@scmc.org.br', perfil: 'contratada_scmc', oss_id: '11111111-1111-1111-1111-111111111111', ativo: true },
  { usuario_id: 'aaaa0006-0006-0006-0006-000000000006', nome: 'Operador INDSH', email: 'operador@indsh.org.br', perfil: 'contratada_indsh', oss_id: '22222222-2222-2222-2222-222222222222', ativo: true },
]

// --- DASHBOARD RESUMO ---
export const mockDashboard: DashboardResumo = {
  repasse_final: 9990000,
  total_descontos: 10000,
  indicadores_cumpridos: 3,
  indicadores_total: 7,
  alertas_criticos: 1,
}

// --- DADOS HISTORICOS (últimos 6 meses HMA urgência) ---
export const mockHistorico = [
  { mes: '2025-10-01', realizado: 11800, meta: 12000 },
  { mes: '2025-11-01', realizado: 12100, meta: 12000 },
  { mes: '2025-12-01', realizado: 11500, meta: 12000 },
  { mes: '2026-01-01', realizado: 12400, meta: 12000 },
  { mes: '2026-02-01', realizado: 12200, meta: 12000 },
  { mes: '2026-03-01', realizado: 12500, meta: 12000 },
]
