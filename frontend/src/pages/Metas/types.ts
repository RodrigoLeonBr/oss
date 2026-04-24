/** Papel da linha na decomposição (API `tb_metas.papel`) */
export type MetaPapel = 'avulsa' | 'agregada' | 'componente'

// ── Meta record (espelha tb_metas via API) ────────────────────────────────────
export interface MetaRecord {
  id: string
  indicadorId: string
  versao: number
  /** Vigência efetiva vem do indicador (API replica em cada meta) */
  vigenciaInicio: string | null
  vigenciaFim: string | null
  metaMensal: number | null
  metaAnual: number | null
  metaValorQualit: number | null
  /** Percentual 0–100 sobre o valor de referência (meta mensal ou meta de qualidade) */
  metaMinima: number | null
  /** Percentual 0–100 sobre o valor de referência */
  metaParcial: number | null
  metaTipo: 'maior_igual' | 'menor_igual'
  unidadeMedida: string | null
  /** Nome identificador da linha (obrigatório; substitui o uso de observações como título) */
  nome: string
  observacoes: string | null
  prazoImplantacao: string | null
  status: 'vigente' | 'encerrada'
  /** Raiz do pacote; filhas têm o id da agregada */
  parentMetaId?: string | null
  papel?: MetaPapel
  /** Peso relativo do componente (só `componente`) */
  peso?: number | null
  children?: MetaRecord[]
  parent?: MetaRecord
  createdAt?: string
  updatedAt?: string
  indicador?: {
    id: string
    nome: string
    tipo: 'producao' | 'qualidade'
    unidadeId?: string
    vigenciaInicio?: string | null
    vigenciaFim?: string | null
    prazoImplantacao?: string | null
    unidade?: { id: string; nome: string }
  }
}

// ── Dados do formulário ────────────────────────────────────────────────────────
export interface MetaFormData {
  nome: string
  metaMensal: string
  metaAnual: string
  metaValorQualit: string
  metaMinima: string
  metaParcial: string
  metaTipo: 'maior_igual' | 'menor_igual'
  unidadeMedida: string
  observacoes: string
}

export interface MetaFormErrors {
  indicadorVigencia?: string
  nome?: string
  metaMensal?: string
  metaAnual?: string
  metaValorQualit?: string
  metaMinima?: string
  metaParcial?: string
  unidadeMedida?: string
}

// ── Labels / estilos de status ────────────────────────────────────────────────
export const STATUS_LABELS: Record<MetaRecord['status'], string> = {
  vigente:   'Vigente',
  encerrada: 'Encerrada',
}

export const STATUS_BADGE: Record<MetaRecord['status'], string> = {
  vigente:   'bg-status-ok-bg text-status-ok border border-status-ok-border',
  encerrada: 'bg-surface-alt text-text-secondary border border-border-subtle',
}

export const STATUS_DOT: Record<MetaRecord['status'], string> = {
  vigente:   'bg-status-ok',
  encerrada: 'bg-text-faint',
}

export const PAPEL_LABEL: Record<MetaPapel, string> = {
  avulsa:      'Avulsa',
  agregada:    'Pacote',
  componente:  'Componente',
}

/** Linha editável no formulário de pacote (POST /metas/pacote) */
export interface MetaPacoteComponenteForm {
  nome: string
  metaMensal: string
  metaAnual: string
  peso: string
  metaMinima: string
  metaParcial: string
  observacoes: string
}

export const emptyComponente = (): MetaPacoteComponenteForm => ({
  nome: '',
  metaMensal: '',
  metaAnual: '',
  peso: '1',
  metaMinima: '',
  metaParcial: '',
  observacoes: '',
})

// ── Formatação ─────────────────────────────────────────────────────────────────
export function formatarValor(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function formatarData(d: string | null | undefined): string {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ── Unwrap ─────────────────────────────────────────────────────────────────────
export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

// ── Mock data (fallback DEV) ──────────────────────────────────────────────────
export const mockMetas: MetaRecord[] = [
  {
    id: 'm1111111-1111-1111-1111-111111111111',
    indicadorId: 'i1111111-1111-1111-1111-111111111111',
    versao: 2,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    metaMensal: 1200,
    metaAnual: 14400,
    metaValorQualit: null,
    metaMinima: 70,
    metaParcial: 85,
    metaTipo: 'maior_igual',
    unidadeMedida: 'atendimentos',
    nome: 'Ocupação leitos — referência 2026',
    observacoes: 'Ajuste contratual',
    prazoImplantacao: null,
    status: 'vigente',
    createdAt: '2026-01-01T00:00:00.000Z',
    indicador: {
      id: 'i1111111-1111-1111-1111-111111111111',
      nome: 'Taxa de Ocupação de Leitos',
      tipo: 'producao',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro' },
    },
  },
  {
    id: 'm2222222-2222-2222-2222-222222222222',
    indicadorId: 'i1111111-1111-1111-1111-111111111111',
    versao: 1,
    vigenciaInicio: '2025-01-01',
    vigenciaFim: '2025-12-31',
    metaMensal: 1100,
    metaAnual: 13200,
    metaValorQualit: null,
    metaMinima: 70,
    metaParcial: 85,
    metaTipo: 'maior_igual',
    unidadeMedida: 'atendimentos',
    nome: 'Ocupação leitos — série anterior',
    observacoes: null,
    prazoImplantacao: null,
    status: 'encerrada',
    createdAt: '2025-01-01T00:00:00.000Z',
    indicador: {
      id: 'i1111111-1111-1111-1111-111111111111',
      nome: 'Taxa de Ocupação de Leitos',
      tipo: 'producao',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro' },
    },
  },
  {
    id: 'm3333333-3333-3333-3333-333333333333',
    indicadorId: 'i2222222-2222-2222-2222-222222222222',
    versao: 1,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    metaMensal: null,
    metaAnual: null,
    metaValorQualit: 30,
    metaMinima: 50,
    metaParcial: 80,
    metaTipo: 'menor_igual',
    unidadeMedida: 'minutos',
    nome: 'Tempo de espera — fila classificação',
    observacoes: 'Informativo operacional',
    prazoImplantacao: null,
    status: 'vigente',
    createdAt: '2026-01-01T00:00:00.000Z',
    indicador: {
      id: 'i2222222-2222-2222-2222-222222222222',
      nome: 'Tempo Médio de Espera',
      tipo: 'qualidade',
      unidadeId: 'u1111111-1111-1111-1111-111111111111',
      unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro' },
    },
  },
]
