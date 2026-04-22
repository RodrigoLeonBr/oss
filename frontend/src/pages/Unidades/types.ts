// ── Alinhado a tb_unidades (exceto PK, timestamps, deleted_at) ───────────────

/** Valores do ENUM no MySQL / Sequelize */
export type UnidadeTipo = 'hospital' | 'upa' | 'unacon' | 'pa' | 'ambulatorio' | 'outro'

export interface UnidadeRecord {
  id: string
  contratoId: string
  nome: string
  sigla: string
  endereco: string
  /** Cadastro SUS (7) ou outro id numérico guardado em tb_unidades.cnes (varchar 20) */
  cnes: string | null
  tipo: UnidadeTipo
  porte: string | null
  capacidade: number
  capacidadeLeitos: number | null
  /** Lista ou objeto JSON vindo do backend */
  especialidades: string[] | Record<string, unknown> | null
  responsavelTecnico: string | null
  valorMensalUnidade: number | null
  percentualPeso: number | null
  status: 'ativa' | 'inativa'
  createdAt?: string
  updatedAt?: string
  contrato?: {
    id: string
    numeroContrato: string
    oss?: { id: string; nome: string }
  }
}

export interface UnidadeFormData {
  contratoId: string
  nome: string
  sigla: string
  endereco: string
  /** Dígitos (CNES 7, CNPJ 14, etc.) — mapeia para coluna cnes */
  cnes: string
  tipo: UnidadeTipo
  porte: string
  capacidade: string
  especialidades: string
  responsavelTecnico: string
  valorMensal: string
  percentualPeso: string
  status: 'ativa' | 'inativa'
}

export interface UnidadeFormErrors {
  contratoId?: string
  nome?: string
  sigla?: string
  endereco?: string
  cnes?: string
  tipo?: string
  porte?: string
  capacidade?: string
  especialidades?: string
  responsavelTecnico?: string
  valorMensal?: string
  percentualPeso?: string
}

export const TIPO_LABELS: Record<UnidadeTipo, string> = {
  hospital:    'Hospital',
  upa:         'UPA 24h',
  unacon:      'Unacon',
  pa:          'Pronto atendimento',
  ambulatorio: 'Ambulatório',
  outro:       'Outro',
}

export const TIPO_BADGE: Record<UnidadeTipo, string> = {
  hospital:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  upa:         'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  unacon:      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200',
  pa:          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  ambulatorio: 'bg-primary/10 text-primary',
  outro:       'bg-surface-alt text-text-secondary border border-border-subtle',
}

export const STATUS_LABELS: Record<UnidadeRecord['status'], string> = {
  ativa:   'Ativa',
  inativa: 'Inativa',
}

export const STATUS_BADGE: Record<UnidadeRecord['status'], string> = {
  ativa:   'bg-status-ok-bg text-status-ok',
  inativa: 'bg-surface-alt text-text-secondary border border-border-subtle',
}

export const STATUS_DOT: Record<UnidadeRecord['status'], string> = {
  ativa:   'bg-status-ok',
  inativa: 'bg-text-faint',
}

function tipoBadgeSafe(t: string): string {
  return t in TIPO_BADGE ? TIPO_BADGE[t as UnidadeTipo] : TIPO_BADGE.outro
}

function tipoLabelSafe(t: string): string {
  return t in TIPO_LABELS ? TIPO_LABELS[t as UnidadeTipo] : t
}

export { tipoBadgeSafe, tipoLabelSafe }

export function formatarCnesOuDoc(val: string | null | undefined): string {
  if (!val) return '—'
  const d = val.replace(/\D/g, '')
  if (d.length === 7) return d
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }
  return val
}

export function mascarCnesOuDoc(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 7) return d
  if (d.length <= 8)  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

function espToString(esp: UnidadeRecord['especialidades']): string {
  if (!esp) return ''
  if (Array.isArray(esp)) return esp.join(', ')
  if (typeof esp === 'object') return Object.values(esp).filter(Boolean).join(', ')
  return String(esp)
}

export function unidadeToFormData(u: UnidadeRecord): UnidadeFormData {
  const cnesRaw = u.cnes != null ? String(u.cnes).replace(/\D/g, '') : ''
  return {
    contratoId: u.contratoId,
    nome: u.nome,
    sigla: u.sigla,
    endereco: u.endereco,
    cnes: cnesRaw ? mascarCnesOuDoc(cnesRaw) : '',
    tipo: u.tipo,
    porte: u.porte ?? '',
    capacidade: String(u.capacidade),
    especialidades: espToString(u.especialidades),
    responsavelTecnico: u.responsavelTecnico ?? '',
    valorMensal: u.valorMensalUnidade != null ? String(u.valorMensalUnidade) : '',
    percentualPeso: u.percentualPeso != null ? String(u.percentualPeso) : '',
    status: u.status,
  }
}

// ── Mock (DEV / stories) — tipos = ENUM do banco (upa, não "upas") ─────────
export const mockUnidades: UnidadeRecord[] = [
  {
    id: 'u1111111-1111-1111-1111-111111111111',
    contratoId: 'c1111111-1111-1111-1111-111111111111',
    nome: 'UPA 24h Centro',
    sigla: 'UPAC',
    endereco: 'Av. Brasil, 1500 – Centro, Americana/SP',
    cnes: '1234567',
    tipo: 'upa',
    porte: 'III',
    capacidade: 50,
    capacidadeLeitos: 50,
    especialidades: ['clínica médica', 'pediatria'],
    responsavelTecnico: null,
    valorMensalUnidade: null,
    percentualPeso: 15,
    status: 'ativa',
    createdAt: '2024-01-15T00:00:00.000Z',
    contrato: {
      id: 'c1111111-1111-1111-1111-111111111111',
      numeroContrato: 'CTR-2024-001',
      oss: { id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis' },
    },
  },
  {
    id: 'u2222222-2222-2222-2222-222222222222',
    contratoId: 'c1111111-1111-1111-1111-111111111111',
    nome: 'Ambulatório de Especialidades Norte',
    sigla: 'AEN',
    endereco: 'Rua das Flores, 320 – Jardim Norte, Americana/SP',
    cnes: '2345678',
    tipo: 'ambulatorio',
    porte: null,
    capacidade: 120,
    capacidadeLeitos: 120,
    especialidades: null,
    responsavelTecnico: 'Dr. João',
    valorMensalUnidade: 150000,
    percentualPeso: 10.5,
    status: 'ativa',
    createdAt: '2024-02-01T00:00:00.000Z',
    contrato: {
      id: 'c1111111-1111-1111-1111-111111111111',
      numeroContrato: 'CTR-2024-001',
      oss: { id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis' },
    },
  },
  {
    id: 'u3333333-3333-3333-3333-333333333333',
    contratoId: 'c2222222-2222-2222-2222-222222222222',
    nome: 'Hospital Municipal de Americana',
    sigla: 'HMA',
    endereco: 'Rua Cel. Mursa, 600 – Vila Gallo, Americana/SP',
    cnes: '62.173.620/0002-61',
    tipo: 'hospital',
    porte: 'II',
    capacidade: 300,
    capacidadeLeitos: 300,
    especialidades: null,
    responsavelTecnico: null,
    valorMensalUnidade: null,
    percentualPeso: null,
    status: 'ativa',
    createdAt: '2024-03-10T00:00:00.000Z',
    contrato: {
      id: 'c2222222-2222-2222-2222-222222222222',
      numeroContrato: 'CTR-2024-002',
      oss: { id: '22222222-2222-2222-2222-222222222222', nome: 'INDSH' },
    },
  },
  {
    id: 'u4444444-4444-4444-4444-444444444444',
    contratoId: 'c2222222-2222-2222-2222-222222222222',
    nome: 'UPA 24h Antônio Zanaga',
    sigla: 'UPAA',
    endereco: 'Av. Antônio Zanaga, 2000 – Jd. Boer, Americana/SP',
    cnes: null,
    tipo: 'upa',
    porte: null,
    capacidade: 40,
    capacidadeLeitos: 40,
    especialidades: null,
    responsavelTecnico: null,
    valorMensalUnidade: null,
    percentualPeso: null,
    status: 'inativa',
    createdAt: '2024-04-05T00:00:00.000Z',
    contrato: {
      id: 'c2222222-2222-2222-2222-222222222222',
      numeroContrato: 'CTR-2024-002',
      oss: { id: '22222222-2222-2222-2222-222222222222', nome: 'INDSH' },
    },
  },
  {
    id: 'u5555555-5555-5555-5555-555555555555',
    contratoId: 'c1111111-1111-1111-1111-111111111111',
    nome: 'Ambulatório Infantil Sul',
    sigla: 'AIS',
    endereco: 'Rua São Paulo, 88 – Vila Santa Catarina, Americana/SP',
    cnes: '4567890',
    tipo: 'ambulatorio',
    porte: 'I',
    capacidade: 80,
    capacidadeLeitos: 80,
    especialidades: ['pediatria'],
    responsavelTecnico: null,
    valorMensalUnidade: 80000,
    percentualPeso: 8,
    status: 'ativa',
    createdAt: '2024-05-20T00:00:00.000Z',
    contrato: {
      id: 'c1111111-1111-1111-1111-111111111111',
      numeroContrato: 'CTR-2024-001',
      oss: { id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis' },
    },
  },
]
