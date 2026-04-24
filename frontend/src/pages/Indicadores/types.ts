// ── Indicador record (espelha o model Sequelize via API) ─────────────────────
export interface IndicadorRecord {
  id: string
  unidadeId: string
  nome: string
  descricao?: string | null
  tipo: 'producao' | 'qualidade'
  metaPadrao: number | null
  unidadeMedida: string | null
  /** Vigência e prazo vêm do indicador (não da meta) */
  vigenciaInicio: string | null
  vigenciaFim: string | null
  prazoImplantacao: string | null
  status: 'ativo' | 'inativo'
  createdAt?: string
  updatedAt?: string
  unidade?: { id: string; nome: string; sigla?: string | null }
}

// ── Dados do formulário (campos como string para inputs) ──────────────────────
export interface IndicadorFormData {
  nome: string
  descricao: string
  tipo: 'producao' | 'qualidade'
  metaPadrao: string
  unidadeMedida: string
  vigenciaInicio: string
  vigenciaFim: string
  prazoImplantacao: string
  status: 'ativo' | 'inativo'
}

// ── Erros de validação ────────────────────────────────────────────────────────
export interface IndicadorFormErrors {
  nome?: string
  descricao?: string
  tipo?: string
  metaPadrao?: string
  unidadeMedida?: string
  vigenciaInicio?: string
}

// ── Labels / estilos de tipo ──────────────────────────────────────────────────
export const TIPO_LABELS: Record<IndicadorRecord['tipo'], string> = {
  producao:  'Produção',
  qualidade: 'Qualidade',
}

export const TIPO_BADGE: Record<IndicadorRecord['tipo'], string> = {
  producao:  'bg-primary/10 text-primary',
  qualidade: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

// ── Labels / estilos de status ────────────────────────────────────────────────
export const STATUS_LABELS: Record<IndicadorRecord['status'], string> = {
  ativo:   'Ativo',
  inativo: 'Inativo',
}

export const STATUS_BADGE: Record<IndicadorRecord['status'], string> = {
  ativo:   'bg-status-ok-bg text-status-ok',
  inativo: 'bg-surface-alt text-text-secondary border border-border-subtle',
}

export const STATUS_DOT: Record<IndicadorRecord['status'], string> = {
  ativo:   'bg-status-ok',
  inativo: 'bg-text-faint',
}

// ── Formatação de meta padrão ─────────────────────────────────────────────────
export function formatarMeta(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── API response unwrapper ────────────────────────────────────────────────────
export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

// ── Mock data (fallback DEV) ──────────────────────────────────────────────────
export const mockIndicadores: IndicadorRecord[] = [
  {
    id: 'i1111111-1111-1111-1111-111111111111',
    unidadeId: 'u1111111-1111-1111-1111-111111111111',
    nome: 'Taxa de Ocupação de Leitos',
    descricao: 'Percentual de leitos ocupados em relação ao total disponível',
    tipo: 'producao',
    metaPadrao: 85.00,
    unidadeMedida: '%',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    prazoImplantacao: null,
    status: 'ativo',
    createdAt: '2024-01-15T00:00:00.000Z',
    unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro', sigla: 'UPA-CTR' },
  },
  {
    id: 'i2222222-2222-2222-2222-222222222222',
    unidadeId: 'u1111111-1111-1111-1111-111111111111',
    nome: 'Tempo Médio de Espera',
    descricao: 'Tempo médio de espera do paciente para atendimento inicial',
    tipo: 'qualidade',
    metaPadrao: 30.00,
    unidadeMedida: 'minutos',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    prazoImplantacao: null,
    status: 'ativo',
    createdAt: '2024-01-15T00:00:00.000Z',
    unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro', sigla: 'UPA-CTR' },
  },
  {
    id: 'i3333333-3333-3333-3333-333333333333',
    unidadeId: 'u1111111-1111-1111-1111-111111111111',
    nome: 'Atendimentos Realizados',
    descricao: 'Total de atendimentos realizados no mês de referência',
    tipo: 'producao',
    metaPadrao: 1500.00,
    unidadeMedida: 'atendimentos',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    prazoImplantacao: null,
    status: 'ativo',
    createdAt: '2024-02-01T00:00:00.000Z',
    unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro', sigla: 'UPA-CTR' },
  },
  {
    id: 'i4444444-4444-4444-4444-444444444444',
    unidadeId: 'u2222222-2222-2222-2222-222222222222',
    nome: 'Satisfação do Paciente',
    descricao: 'Percentual de pacientes satisfeitos ou muito satisfeitos com o atendimento',
    tipo: 'qualidade',
    metaPadrao: 90.00,
    unidadeMedida: '%',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    prazoImplantacao: null,
    status: 'ativo',
    createdAt: '2024-02-01T00:00:00.000Z',
    unidade: { id: 'u2222222-2222-2222-2222-222222222222', nome: 'Ambulatório de Especialidades Norte', sigla: 'AMB-N' },
  },
  {
    id: 'i5555555-5555-5555-5555-555555555555',
    unidadeId: 'u1111111-1111-1111-1111-111111111111',
    nome: 'Reinternações em 30 dias',
    descricao: 'Taxa de reinternações em até 30 dias após a alta hospitalar',
    tipo: 'qualidade',
    metaPadrao: 5.00,
    unidadeMedida: '%',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    prazoImplantacao: null,
    status: 'inativo',
    createdAt: '2024-03-01T00:00:00.000Z',
    unidade: { id: 'u1111111-1111-1111-1111-111111111111', nome: 'UPA 24h Centro', sigla: 'UPA-CTR' },
  },
]
