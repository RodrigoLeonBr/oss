export type Perfil =
  | 'admin'
  | 'gestor_sms'
  | 'auditora'
  | 'conselheiro_cms'
  | 'contratada_scmc'
  | 'contratada_indsh'
  | 'central_regulacao'
  | 'visualizador'

export type StatusCumprimento = 'cumprido' | 'parcial' | 'nao_cumprido' | 'nao_aplicavel' | 'aguardando'
export type StatusContrato = 'Ativo' | 'Encerrado' | 'Suspenso' | 'Rompido'
export type StatusAprovacao = 'rascunho' | 'submetido' | 'aprovado' | 'rejeitado'
export type TipoIndicador = 'quantitativo' | 'qualitativo'
export type GrupoIndicador = 'auditoria_operacional' | 'qualidade_atencao' | 'transversal' | 'rh'
export type FaixaProducao = 'acima_meta' | 'entre_85_100' | 'entre_70_84' | 'abaixo_70'
export type ModeloDesconto = 'flat' | 'ponderado'
export type TipoUnidade = 'hospital' | 'upa' | 'unacon' | 'pa' | 'ambulatorio' | 'outro'

export interface Usuario {
  usuario_id: string
  nome: string
  email: string
  cpf?: string
  telefone?: string
  perfil: Perfil
  oss_id?: string
  ativo: boolean
  ultimo_acesso?: string
}

export interface Oss {
  oss_id: string
  nome: string
  cnpj: string
  tipo_org: string
  email?: string
  telefone?: string
  site?: string
  ativa: boolean
}

export interface Contrato {
  contrato_id: string
  oss_id: string
  numero: string
  tipo: string
  data_inicio: string
  data_fim: string
  valor_mensal_base: number
  valor_anual: number
  perc_fixo: number
  perc_variavel: number
  modelo_desconto_qual: ModeloDesconto
  numero_aditivos: number
  status: StatusContrato
  observacoes?: string
  organizacao?: Oss
  unidades?: Unidade[]
}

export interface Unidade {
  unidade_id: string
  contrato_id: string
  nome: string
  sigla: string
  tipo: TipoUnidade
  cnes?: string
  porte?: string
  capacidade_leitos?: number
  especialidades?: string[]
  valor_mensal_unidade?: number
  percentual_peso?: number
  ativa: boolean
  blocos?: BlocoProducao[]
}

export interface BlocoProducao {
  bloco_id: string
  unidade_id: string
  codigo: string
  nome: string
  descricao?: string
  valor_mensal_alocado: number
  percentual_peso_bloco: number
  ativo: boolean
}

export interface Indicador {
  indicador_id: string
  unidade_id?: string
  bloco_id?: string
  codigo: string
  nome: string
  descricao?: string
  tipo: TipoIndicador
  grupo: GrupoIndicador
  formula_calculo?: string
  unidade_medida?: string
  periodicidade: string
  tipo_implantacao: boolean
  fonte_dados: string
  peso_perc: number
  meta_tipo: string
  versao: number
  ativo: boolean
  unidade?: Unidade
  bloco?: BlocoProducao
}

export interface Meta {
  meta_id: string
  indicador_id: string
  aditivo_id?: string
  versao: number
  vigencia_inicio: string
  vigencia_fim?: string
  meta_mensal?: number
  meta_anual?: number
  meta_valor_qualit?: number
  meta_minima?: number
  meta_parcial?: number
  unidade_medida?: string
  observacoes?: string
}

export interface AcompanhamentoMensal {
  acomp_id: string
  indicador_id: string
  meta_id: string
  mes_referencia: string
  meta_vigente_mensal?: number
  meta_vigente_qualit?: number
  valor_realizado?: number
  percentual_cumprimento?: number
  variacao_vs_mes_ant?: number
  status_cumprimento: StatusCumprimento
  faixa_producao?: FaixaProducao
  status_aprovacao: StatusAprovacao
  descricao_desvios?: string
  preenchido_por?: string
  data_preenchimento?: string
  aprovado_por?: string
  data_aprovacao?: string
  motivo_rejeicao?: string
  desconto_estimado: number
  indicador?: Indicador
}

export interface DescontoBloco {
  desc_bloco_id: string
  repasse_id: string
  bloco_id: string
  mes_referencia: string
  meta_mensal: number
  valor_realizado: number
  percentual_atingimento: number
  faixa: FaixaProducao
  orcamento_bloco: number
  percentual_desconto: number
  valor_desconto: number
  auditado: boolean
  bloco?: BlocoProducao
}

export interface DescontoIndicador {
  desc_ind_id: string
  repasse_id: string
  acomp_id: string
  indicador_id: string
  mes_referencia: string
  modelo_desconto: ModeloDesconto
  peso_indicador: number
  percentual_desconto: number
  valor_desconto: number
  auditado: boolean
  indicador?: Indicador
}

export interface RepasseMensal {
  repasse_id: string
  contrato_id: string
  mes_referencia: string
  valor_mensal_base: number
  parcela_fixa: number
  parcela_variavel: number
  desconto_producao_total: number
  desconto_qualidade_total: number
  desconto_total: number
  repasse_final: number
  percentual_retido: number
  status: string
  descontos_bloco?: DescontoBloco[]
  descontos_indicador?: DescontoIndicador[]
}

export interface DashboardResumo {
  repasse_final: number
  total_descontos: number
  indicadores_cumpridos: number
  indicadores_total: number
  alertas_criticos: number
}
