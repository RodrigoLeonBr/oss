// ── Unidade record (espelha o model Sequelize) ────────────────────────────────
export interface UnidadeRecord {
  id: string
  contratoId: string
  nome: string
  endereco: string
  cnpj?: string | null
  tipo: 'ambulatorio' | 'hospital' | 'upas'
  capacidade: number
  status: 'ativa' | 'inativa'
  createdAt?: string
  updatedAt?: string
  contrato?: {
    id: string
    numeroContrato: string
    oss?: { id: string; nome: string }
  }
}

// ── Dados do formulário (campos como string para inputs) ──────────────────────
export interface UnidadeFormData {
  contratoId: string
  nome: string
  endereco: string
  cnpj: string
  tipo: 'ambulatorio' | 'hospital' | 'upas'
  capacidade: string
  status: 'ativa' | 'inativa'
}

// ── Erros de validação ────────────────────────────────────────────────────────
export interface UnidadeFormErrors {
  contratoId?: string
  nome?: string
  endereco?: string
  cnpj?: string
  tipo?: string
  capacidade?: string
}

// ── Labels / estilos de tipo ──────────────────────────────────────────────────
export const TIPO_LABELS: Record<UnidadeRecord['tipo'], string> = {
  ambulatorio: 'Ambulatório',
  hospital:    'Hospital',
  upas:        'UPA 24h',
}

export const TIPO_BADGE: Record<UnidadeRecord['tipo'], string> = {
  ambulatorio: 'bg-primary/10 text-primary',
  hospital:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  upas:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

// ── Labels / estilos de status ────────────────────────────────────────────────
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

// ── Helpers de formatação ─────────────────────────────────────────────────────
export function formatarCNPJUnidade(cnpj: string | null | undefined): string {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function mascaraCNPJUnidade(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// ── API response unwrapper ────────────────────────────────────────────────────
export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

// ── Mock data (fallback DEV) ──────────────────────────────────────────────────
export const mockUnidades: UnidadeRecord[] = [
  {
    id: 'u1111111-1111-1111-1111-111111111111',
    contratoId: 'c1111111-1111-1111-1111-111111111111',
    nome: 'UPA 24h Centro',
    endereco: 'Av. Brasil, 1500 – Centro, Americana/SP',
    cnpj: '04.364.900/0002-50',
    tipo: 'upas',
    capacidade: 50,
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
    endereco: 'Rua das Flores, 320 – Jardim Norte, Americana/SP',
    cnpj: '04.364.900/0003-31',
    tipo: 'ambulatorio',
    capacidade: 120,
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
    endereco: 'Rua Cel. Mursa, 600 – Vila Gallo, Americana/SP',
    cnpj: '62.173.620/0002-61',
    tipo: 'hospital',
    capacidade: 300,
    status: 'ativa',
    createdAt: '2024-03-10T00:00:00.000Z',
    contrato: {
      id: 'c2222222-2222-2222-2222-222222222222',
      numeroContrato: 'CTR-2024-002',
      oss: { id: '22222222-2222-2222-2222-222222222222', nome: 'Instituto Nacional de Desenvolvimento Social e Humano' },
    },
  },
  {
    id: 'u4444444-4444-4444-4444-444444444444',
    contratoId: 'c2222222-2222-2222-2222-222222222222',
    nome: 'UPA 24h Antônio Zanaga',
    endereco: 'Av. Antônio Zanaga, 2000 – Jd. Boer, Americana/SP',
    cnpj: null,
    tipo: 'upas',
    capacidade: 40,
    status: 'inativa',
    createdAt: '2024-04-05T00:00:00.000Z',
    contrato: {
      id: 'c2222222-2222-2222-2222-222222222222',
      numeroContrato: 'CTR-2024-002',
      oss: { id: '22222222-2222-2222-2222-222222222222', nome: 'Instituto Nacional de Desenvolvimento Social e Humano' },
    },
  },
  {
    id: 'u5555555-5555-5555-5555-555555555555',
    contratoId: 'c1111111-1111-1111-1111-111111111111',
    nome: 'Ambulatório Infantil Sul',
    endereco: 'Rua São Paulo, 88 – Vila Santa Catarina, Americana/SP',
    cnpj: '04.364.900/0004-12',
    tipo: 'ambulatorio',
    capacidade: 80,
    status: 'ativa',
    createdAt: '2024-05-20T00:00:00.000Z',
    contrato: {
      id: 'c1111111-1111-1111-1111-111111111111',
      numeroContrato: 'CTR-2024-001',
      oss: { id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis' },
    },
  },
]
