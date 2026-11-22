export { unwrap } from '../Producao/types'

export type Classe = 'realizado' | 'nao_realizado' | 'ausencia'
export type Visao = 'ambos' | 'previsto' | 'realizado'

export interface PlTotal { plantoes: number; horas: number }

export interface SetorResumo {
  setorId: string
  nome: string
  area: 'medica' | 'enfermagem' | 'multiprofissional' | 'apoio'
  profissionais: number
  previsto: PlTotal
  realizado: PlTotal
  naoRealizado: number
  vagos: number
  diasSemPlantao: number
}

export interface Plantao {
  plantaoId: string
  data: string
  inicio: string
  fim: string
  horas: number
  marcacao: string
  modalidade: string
  vinculo: 'oss' | 'pma'
  textoBruto: string | null
  classe: Classe
  profissionalId: string | null
  profissional: string | null
  registro: string | null
  categoria: string | null
  funcao: string
  funcaoLabel: string
  setorId: string | null
  setor: string | null
  unidadeId: string
  unidade: string
}

export interface Grade {
  dias: string[]
  plantoes: Plantao[]
  totais: { previsto: PlTotal; realizado: PlTotal; naoRealizado: number; vagos: number }
}

export interface ProfissionalBusca {
  profissionalId: string
  nome: string
  conselho: string
  registroNumero: string
  registroUf: string
  categoria: string | null
}

export interface Dimensionamento {
  dimensionamentoId: string
  unidadeId: string
  setorId: string
  setor: string
  categoria: string | null
  turnoInicio: string
  turnoFim: string
  qtdPostos: number
  diasSemana: string
  vigenciaInicio: string
  vigenciaFim: string | null
  fonte: string | null
  obs: string | null
}

export interface DiaCobertura { data: string; exigido: number; apresentado: number | null; realizado: number | null }

export interface LinhaContrato extends Dimensionamento {
  horasTurno: number
  dias: DiaCobertura[]
  totais: { exigidos: number; apresentados: number; realizados: number; turnosComDeficit: number; coberturaPerc: number | null }
}

export interface ContratoApresentado {
  dias: string[]
  linhas: LinhaContrato[]
  resumo: {
    postosDiaExigidos: number; postosDiaApresentados: number; postosDiaRealizados: number
    horasContratadas: number; horasApresentadas: number; horasRealizadas: number
    turnosComDeficit: number; coberturaPerc: number | null
  } | null
}

export const AREA_LABEL: Record<SetorResumo['area'], string> = {
  medica: 'Médica', enfermagem: 'Enfermagem', multiprofissional: 'Multiprofissional', apoio: 'Apoio',
}

export const CATEGORIAS: { v: string; label: string }[] = [
  { v: '', label: 'Qualquer' },
  { v: 'medico', label: 'Médico' },
  { v: 'enfermagem', label: 'Enfermagem' },
  { v: 'farmaceutico', label: 'Farmacêutico' },
  { v: 'tecnico_radiologia', label: 'Técnico de radiologia' },
  { v: 'assistente_social', label: 'Assistente social' },
  { v: 'dentista', label: 'Dentista' },
]

export const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] // índice 0 = domingo (DAYOFWEEK 1)

/** 'YYYY-MM-DD' → 0..6 (0 = domingo), sem fuso. */
export const diaDaSemana = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay()

export const hora = (iso: string) => iso.slice(11, 13)
export const hhmm = (iso: string) => iso.slice(11, 16)
export const fmtH = (h: number) => h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/** Tooltip do plantão. */
export const dica = (p: Plantao) => [
  `${p.data.split('-').reverse().join('/')} ${hhmm(p.inicio)}–${hhmm(p.fim)} (${fmtH(p.horas)} h)`,
  p.profissional ?? 'POSTO VAGO',
  p.registro,
  p.funcaoLabel,
  `${p.marcacao}${p.modalidade !== 'plantao' ? ` · ${p.modalidade}` : ''}${p.vinculo === 'pma' ? ' · PMA' : ''}`,
  p.textoBruto && p.textoBruto !== p.profissional ? `"${p.textoBruto}"` : null,
].filter(Boolean).join('\n')

/** Ordem de exibição das funções (médicos, enfermeiros, técnicos, resto alfabético). */
const ORDEM_FUNCAO = ['clinico', 'pediatria', 'medico', 'enfermeiro', 'tecnico_enfermagem', 'enfermagem']
export const ordemFuncao = (a: string, b: string, labels: Map<string, string>) => {
  const ia = ORDEM_FUNCAO.indexOf(a), ib = ORDEM_FUNCAO.indexOf(b)
  if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  return (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b)
}

export type Turno = 'dia' | 'noite'

const somaDia = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** minutos de `iso` contados a partir de 00:00 de `ymd` (pode passar de 1440 ou ser negativo) */
const minDe = (ymd: string, iso: string) =>
  Math.round((Date.parse(`${iso.slice(0, 16)}:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / 60000)

/**
 * Turnos (dia 07–19, noite 19–07) que o plantão toca, com a data-base do turno.
 * Ex.: 07–19 → dia; 19–07 → noite; 07–07(+1) → dia+noite; 01–07 → noite de data−1.
 * ponytail: corte fixo 07/19; se alguma unidade usar outro, ler de tb_escala_dimensionamento.
 */
export function turnosDoPlantao(p: Pick<Plantao, 'data' | 'inicio' | 'fim'>): { data: string; turno: Turno }[] {
  const ini = minDe(p.data, p.inicio)
  const fim = minDe(p.data, p.fim)
  const out: { data: string; turno: Turno }[] = []
  // janelas: noite anterior [-5h,7h), dia [7h,19h), noite [19h,31h), dia seguinte [31h,43h)
  const janelas: [number, number, number, Turno][] = [
    [-300, 420, -1, 'noite'], [420, 1140, 0, 'dia'], [1140, 1860, 0, 'noite'], [1860, 2580, 1, 'dia'],
  ]
  janelas.forEach(([a, b, off, turno]) => {
    if (Math.min(b, fim) > Math.max(a, ini)) out.push({ data: somaDia(p.data, off), turno })
  })
  return out
}

/** Cor da célula por marcação (vazio = vermelho, não realizado = laranja). */
export function corPlantao(p: Plantao): string {
  if (!p.profissionalId || p.marcacao === 'furo') return 'bg-status-bad-bg text-status-bad border-status-bad-border'
  if (p.classe === 'ausencia') return 'bg-surface-alt text-text-faint border-border-subtle'
  if (p.classe === 'nao_realizado') return 'bg-status-warn-bg text-status-warn border-status-warn-border'
  if (p.marcacao !== 'normal') return 'bg-primary/10 text-primary border-primary/30'
  return 'bg-status-ok-bg text-status-ok border-status-ok-border'
}

export const LEGENDA: { cls: string; label: string }[] = [
  { cls: 'bg-status-ok-bg border-status-ok-border', label: 'Realizado' },
  { cls: 'bg-primary/10 border-primary/30', label: 'Cobertura / troca / extra' },
  { cls: 'bg-status-warn-bg border-status-warn-border', label: 'Não realizado (riscado, falta, atestado)' },
  { cls: 'bg-status-bad-bg border-status-bad-border', label: 'Posto vago / furo' },
  { cls: 'bg-surface-alt border-border-subtle', label: 'Folga / férias' },
]

export function baixarTsv(nome: string, head: string[], rows: (string | number)[][]) {
  const tsv = [head, ...rows].map(r => r.join('\t')).join('\n')
  const url = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
