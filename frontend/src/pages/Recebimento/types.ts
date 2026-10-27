export type StatusNota = 'pendente' | 'aceita' | 'rejeitada'

export interface Nota {
  nota_id: string
  descricao: string
  causa_raiz: string | null
  acao_corretiva: string | null
  status_validacao: StatusNota
  alcance_considerado: number | null
  motivo_rejeicao_nota: string | null
}

export interface Linha {
  indicador_id: string
  codigo: string
  nome: string
  acomp_id: string | null
  status_aprovacao: string | null
  realizado: number | null
  base: number | null
  meta: { meta_tipo?: string; meta_tipo_snap?: string; meta_minima?: string | number | null; meta_parcial?: string | number | null }
  nota: Nota | null
}

export interface LinhaQual extends Linha {
  peso: number
  grupo: string
  pct: number | null
  informativo: boolean
  fator_apurado: number | null
  fator_comissao: number | null
}

export interface Grupo {
  bloco_id: string | null
  codigo: string
  nome: string
  peso: number
  linhas: Linha[]
  pendente: boolean
  // fixa_variavel
  fator_apurado?: number | null
  fator_comissao?: number | null
  // producao_qualidade
  base_linha?: number
  alcance_apurado?: number | null
  alcance_comissao?: number | null
  desc_perc_apurado?: number | null
  desc_perc_comissao?: number | null
  desconto_apurado?: number
  desconto_comissao?: number
}

export interface Resultado {
  nota_qualitativa: number | null
  valor_total: number | null
  // fixa_variavel
  perc_fixa?: number | null
  perc_variavel?: number | null
  valor_fixa?: number | null
  valor_variavel?: number | null
  // producao_qualidade
  perc_escala?: number | null
  valor_escala?: number | null
  desconto_producao?: number | null
}

export type Modelo = 'fixa_variavel' | 'producao_qualidade'

export interface Recebimento {
  contrato_id: string
  numero: string
  mes: string
  modelo: Modelo
  pontuacao: 'proporcional' | 'niveis'
  vigencia: { versao: number; inicio: string; fim: string | null } | null
  valor_mensal_base: number
  parcela_fixa: number
  parcela_variavel: number
  grupos: Grupo[]
  qual: LinhaQual[]
  pendentes: number
  apurado: Resultado
  aposComissao: Resultado
  // producao_qualidade trimestral
  oficial?: { trimestre: string; meses: string[] } | null
  previa?: Grupo[]
}

export const fmtPct = (v: number | null | undefined, casas = 1) =>
  v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

export const fmtFator = (f: number | null | undefined) => (f == null ? '—' : fmtPct(f * 100))

export const fmtBRL = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const fmtNum = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
