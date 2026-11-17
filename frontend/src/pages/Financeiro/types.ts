export type Conta = 'custeio' | 'investimento' | 'provisao'
export const CONTAS: { v: Conta; label: string }[] = [
  { v: 'custeio', label: 'Custeio' },
  { v: 'investimento', label: 'Investimento' },
  { v: 'provisao', label: 'Provisão' },
]
export const CONTA_LABEL: Record<string, string> = { custeio: 'Custeio', investimento: 'Investimento', provisao: 'Provisão' }

export type TipoPeriodo = 'trimestral' | 'quadrimestral' | 'anual' | 'livre'
export interface Periodo { tipo: TipoPeriodo; ano: number; n: number; ini: string; fim: string }
export const TIPOS_PERIODO: { v: TipoPeriodo; label: string; qtd: number }[] = [
  { v: 'trimestral', label: 'Trimestral', qtd: 4 },
  { v: 'quadrimestral', label: 'Quadrimestral', qtd: 3 },
  { v: 'anual', label: 'Anual', qtd: 1 },
  { v: 'livre', label: 'Período livre', qtd: 0 },
]

export interface Escopo { ossId: string; contratoId: string; unidadeId: string; conta: '' | Conta }

export interface OpcaoEscopo {
  oss_id: string; oss_nome: string; contrato_id: string; numero: string
  unidade_id: string; sigla: string; unidade_nome: string
}

export interface GrupoDespesa { codigo: string; nome: string; valor: number; perc: number }

export interface Kpis {
  saldoInicial: number | null; repasse: number; rendimento: number; outrasReceitas: number
  despesa: number; transferencias: number; recursosProprios: number; arredondamento: number
  saldoFinal: number | null; diferencaFluxo: number | null; mesesComDados: number
  coberturaMeses: number | null; despesaPorGrupo: GrupoDespesa[]
}

export interface Janela { inicio: string; fim: string; meses: number; rotulo: string; anterior: { inicio: string; fim: string } }

export interface LinhaDrill extends Partial<Kpis> {
  id: string; nome: string; nivel: string; deltaDespesa?: number | null; perc?: number
}

export interface Observacao {
  obs_id: string; contrato_id: string; contrato: string; tipo: 'nota' | 'secao' | 'pendencia'
  unidade_id: string | null; sigla: string | null; conta: Conta | null; mes_referencia: string | null
  periodo_ini: string | null; periodo_fim: string | null; secao: string | null; texto: string
  status: 'aberta' | 'resolvida' | null; resolvida_em: string | null; origem: 'sistema' | 'historico'
  fonte: string | null; criado_em: string
}

export interface Resumo {
  janela: Janela; nivel: string; atual: Kpis; anterior: Kpis
  variacao: { repasse: number | null; despesa: number | null; saldoFinal: number | null }
  drill: LinhaDrill[]; pendencias: Observacao[]
}

export interface PontoSerie {
  periodo: string; repasse: number; rendimento: number; despesa: number; saldo: number | null
  despesaPorGrupo: GrupoDespesa[]
}
export interface Serie { granularidade: string; pontos: PontoSerie[]; marcos: { mes: string; rotulo: string }[] }

export interface AnoComparativo extends Kpis {
  ano: number; rotulo: string; deltaDespesa: number | null; deltaRepasse: number | null; mensal: PontoSerie[]
}
export interface Comparativo { tipo: string; n: number; anos: AnoComparativo[] }

export interface LinhaDetalhe {
  rubrica_id: string; codigo: string; nome: string; nivel: 'grupo' | 'categoria'; natureza: 'receita' | 'despesa'
  pai: string | null; grupo_canonico: string | null; valores: number[]; total: number
}
export interface Detalhe { janela: Janela; meses: string[]; linhas: LinhaDetalhe[]; observacoes: Observacao[] }

export interface Movimento {
  mov_id?: string; tipo: 'transferencia' | 'recursos_proprios' | 'arredondamento'
  contraparte_unidade_id: string | null; contraparte_conta: Conta | null; descricao: string; valor: number
}
export interface RubricaGrade {
  rubrica_id: string; codigo: string; nome: string; nivel: 'grupo' | 'categoria'
  natureza: 'receita' | 'despesa'; pai: string | null; valor: number | null
}
export interface Grade {
  unidade_id: string; sigla: string; contrato_id: string; conta: Conta; mes: string; fechado: boolean
  rubricas: RubricaGrade[]; movimentos: Movimento[]; saldoAnterior: number | null; saldo: number | null
  totais: { receitas: number; despesas: number; movimentos: number }; avisos: string[]
}

export interface ResumoCarga {
  token?: string; arquivos?: string[]; contrato: string; dryRun: boolean
  abas: { unidade: string; conta: Conta; meses: string[]; saldoInicial: number; saldoFinal: number; avisos: string[] }[]
  diferencas: { unidade: string; conta: Conta; mes: string; campo: string; atual: number | null; novo: number }[]
  totais?: { rubricas: number; lancamentos: number; movimentacoes: number; saldos: number }
}

export interface Fechamento { fechamento_id: string; contrato_id: string; mes_referencia: string; fechado_em: string }

// ── helpers ──
export const unwrap = <T,>(raw: unknown): T =>
  (raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: T }).data : raw) as T

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCurto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
export const fmtBRL = (v: number | null | undefined) => (v == null ? '—' : brl.format(v))
export const fmtCurto = (v: number | null | undefined) => (v == null ? '—' : `R$ ${brlCurto.format(v)}`)
export const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
export const fmtMes = (ymd: string) => { const [y, m] = ymd.split('-'); return `${m}/${y}` }

export const escopoQuery = (e: Escopo) => {
  const p = new URLSearchParams()
  if (e.ossId) p.set('oss_id', e.ossId)
  if (e.contratoId) p.set('contrato_id', e.contratoId)
  if (e.unidadeId) p.set('unidade_id', e.unidadeId)
  if (e.conta) p.set('conta', e.conta)
  return p
}
export const periodoQuery = (p: Periodo, q = new URLSearchParams()) => {
  q.set('tipo', p.tipo)
  if (p.tipo === 'livre') { q.set('ini', p.ini); q.set('fim', p.fim) } else {
    q.set('ano', String(p.ano))
    if (p.tipo !== 'anual') q.set('n', String(p.n))
  }
  return q
}

export const PALETA = ['#1b3a66', '#0d7373', '#b67810', '#c04a45', '#6b5ca5', '#3d7ea6', '#8a6d3b', '#5b8c5a', '#a05a7a', '#8e9cae']
export const TICK = '#8e9cae'
export const GRID = 'rgba(142,156,174,0.12)'
