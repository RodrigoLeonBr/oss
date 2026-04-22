// ── Meta record (espelha tb_metas via API) ────────────────────────────────────
export interface MetaRecord {
  id: string
  indicadorId: string
  versao: number
  vigenciaInicio: string        // YYYY-MM-DD
  vigenciaFim: string | null
  metaMensal: number | null
  metaAnual: number | null
  metaValorQualit: number | null
  metaMinima: number | null
  metaParcial: number | null
  metaTipo: 'maior_igual' | 'menor_igual'
  unidadeMedida: string | null
  observacoes: string | null
  prazoImplantacao: string | null
  status: 'vigente' | 'encerrada'
  createdAt?: string
  updatedAt?: string
  indicador?: {
    id: string
    nome: string
    tipo: 'producao' | 'qualidade'
    unidadeId?: string
    unidade?: { id: string; nome: string }
  }
}

// ── Dados do formulário ────────────────────────────────────────────────────────
export interface MetaFormData {
  vigenciaInicio: string
  vigenciaFim: string
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
  vigenciaInicio?: string
  metaMensal?: string
  metaAnual?: string
  metaValorQualit?: string
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
    metaMinima: 840,
    metaParcial: 1020,
    metaTipo: 'maior_igual',
    unidadeMedida: 'atendimentos',
    observacoes: 'Meta base revisada para 2026',
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
    metaMinima: 770,
    metaParcial: 935,
    metaTipo: 'maior_igual',
    unidadeMedida: 'atendimentos',
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
    metaMinima: 45,
    metaParcial: null,
    metaTipo: 'menor_igual',
    unidadeMedida: 'minutos',
    observacoes: 'Tempo máximo aceitável para atendimento inicial',
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
