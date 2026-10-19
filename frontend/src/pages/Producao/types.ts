export type FonteProducao = 'sia' | 'sih'
export type TipoFiltro = 'grupo' | 'subgrupo' | 'forma' | 'procedimento'

export interface MapaRecord {
  mapa_id: string
  indicador_id: string
  fonte: FonteProducao
  tipo_filtro: TipoFiltro
  valor_filtro: string
  ativo: number
  indicador?: { nome: string; unidade?: { nome: string } }
}

export interface MapaFormData {
  indicadorId: string
  fonte: FonteProducao
  tipoFiltro: TipoFiltro
  valorFiltro: string
}

export interface LinhaComparacao {
  indicadorId: string
  nome: string
  unidadeMedida: string | null
  informado: number | null
  registrado: number | null
  diferenca: number | null
  divergenciaPerc: number | null
  semMapeamento: boolean
}

export interface Comparacao {
  competencia: string
  unidade: { id: string; nome: string; cnes: string }
  linhas: LinhaComparacao[]
}

export const COMPRIMENTO_FILTRO: Record<TipoFiltro, number> = {
  grupo: 2, subgrupo: 4, forma: 6, procedimento: 10,
}

export const TIPO_FILTRO_LABEL: Record<TipoFiltro, string> = {
  grupo: 'Grupo (2 díg)',
  subgrupo: 'Subgrupo (4 díg)',
  forma: 'Forma de organização (6 díg)',
  procedimento: 'Procedimento (10 díg)',
}

export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) return (res as { data: T }).data
  return res as T
}

export function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}
