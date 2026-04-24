// frontend/src/pages/EntradaMensal/types.ts

export type PapelMeta = 'avulsa' | 'agregada' | 'componente'

export interface AcompanhamentoRecord {
  id: string | null
  indicadorId: string
  metaId: string | null
  /** `parent_meta_id` da meta (null em avulsa/agregada raiz) */
  parentMetaId?: string | null
  /** Linha sintética de meta agregada (total do pacote): só exibição, sem lançamento */
  somenteExibicao?: boolean
  /** Rótulo da linha em tb_metas (sub-meta ou avulsa); agregada não entra na listagem de lançamento */
  nomeMeta?: string | null
  papelMeta?: PapelMeta
  /** F global 0–1 do pacote (só metas componente do mesmo agrupamento) */
  cumprimentoPonderadoNoGrupo?: number | null
  /** Soma dos realizados das componentes do mesmo pai (componente) */
  realizadoSomaComponentes?: number | null
  mesReferencia: string
  metaVigenteMensal: number | null
  metaVigenteQualit: number | null
  metaMinima: number | null
  metaParcial: number | null
  metaTipo: 'maior_igual' | 'menor_igual'
  valorRealizado: number | null
  percentualCumprimento: number | null
  statusCumprimento: 'atingido' | 'parcial' | 'nao_atingido' | 'pendente'
  statusAprovacao: 'submetido' | 'aprovado' | 'rejeitado' | null
  descricaoDesvios: string | null
  descontoEstimado: number
  indicador: {
    id: string
    nome: string
    tipo: 'producao' | 'qualidade'
    unidadeId: string
    unidadeMedida: string | null
  }
}

export const STATUS_LABELS: Record<AcompanhamentoRecord['statusCumprimento'], string> = {
  atingido:     'Atingido',
  parcial:      'Parcial',
  nao_atingido: 'Não atingido',
  pendente:     'Pendente',
}

export const STATUS_BADGE: Record<AcompanhamentoRecord['statusCumprimento'], string> = {
  atingido:     'bg-status-ok-bg text-status-ok border border-status-ok-border',
  parcial:      'bg-status-warn-bg text-status-warn border border-status-warn-border',
  nao_atingido: 'bg-status-bad-bg text-status-bad border border-status-bad-border',
  pendente:     'bg-surface-alt text-text-secondary border border-border-subtle',
}

export function calcularStatusPreview(
  metaTipo: 'maior_igual' | 'menor_igual',
  valorRealizado: number | null,
  metaParcial: number | null,
  metaMinima: number | null,
): AcompanhamentoRecord['statusCumprimento'] {
  if (valorRealizado === null) return 'pendente'
  if (metaParcial == null || metaMinima == null) return 'pendente'
  if (metaTipo === 'maior_igual') {
    if (valorRealizado >= metaParcial) return 'atingido'
    if (valorRealizado >= metaMinima) return 'parcial'
    return 'nao_atingido'
  }
  // menor_igual
  if (valorRealizado <= metaMinima) return 'atingido'
  if (valorRealizado <= metaParcial) return 'parcial'
  return 'nao_atingido'
}

export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

export const mockAcompanhamentos: AcompanhamentoRecord[] = [
  {
    id: null,
    indicadorId: 'i1111111-1111-1111-1111-111111111111',
    metaId: 'm1111111-1111-1111-1111-111111111111',
    parentMetaId: null,
    nomeMeta: 'Meta avulsa exemplo',
    papelMeta: 'avulsa',
    mesReferencia: '2026-04-01',
    metaVigenteMensal: 1200,
    metaVigenteQualit: null,
    metaMinima: 840,
    metaParcial: 1020,
    metaTipo: 'maior_igual',
    valorRealizado: null,
    percentualCumprimento: null,
    statusCumprimento: 'pendente',
    statusAprovacao: null,
    descricaoDesvios: null,
    descontoEstimado: 0,
    indicador: {
      id: 'i1111111-1111-1111-1111-111111111111',
      nome: 'Taxa de Ocupação de Leitos',
      tipo: 'producao',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidadeMedida: 'atendimentos',
    },
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    indicadorId: 'i2222222-2222-2222-2222-222222222222',
    metaId: 'm3333333-3333-3333-3333-333333333333',
    parentMetaId: null,
    nomeMeta: null,
    papelMeta: 'avulsa',
    mesReferencia: '2026-04-01',
    metaVigenteMensal: null,
    metaVigenteQualit: 30,
    metaMinima: 45,
    metaParcial: 38,
    metaTipo: 'menor_igual',
    valorRealizado: 28,
    percentualCumprimento: 93.33,
    statusCumprimento: 'atingido',
    statusAprovacao: 'submetido',
    descricaoDesvios: null,
    descontoEstimado: 0,
    indicador: {
      id: 'i2222222-2222-2222-2222-222222222222',
      nome: 'Tempo Médio de Espera',
      tipo: 'qualidade',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidadeMedida: 'minutos',
    },
  },
]
