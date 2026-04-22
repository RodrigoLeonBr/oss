// ── Contrato record (espelha o model Sequelize) ───────────────────────────────
export interface ContratoRecord {
  id: string
  ossId: string
  numeroContrato: string
  periodoInicio: string            // ISO date: 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:…'
  periodoFim: string
  valorMensal: number              // decimal(10,2)
  percentualDesconto?: number | null  // decimal(5,2) — opcional
  status: 'ativo' | 'encerrado' | 'suspenso'
  createdAt?: string
  updatedAt?: string
  oss?: { id: string; nome: string; cnpj: string }  // relação populada pela API
}

// ── Dados do formulário (campos como string para inputs) ──────────────────────
export interface ContratoFormData {
  ossId: string
  numeroContrato: string
  periodoInicio: string
  periodoFim: string
  valorMensal: string
  percentualDesconto: string
  status: 'ativo' | 'encerrado' | 'suspenso'
}

// ── Erros de validação ────────────────────────────────────────────────────────
export interface ContratoFormErrors {
  ossId?: string
  numeroContrato?: string
  periodoInicio?: string
  periodoFim?: string
  valorMensal?: string
  percentualDesconto?: string
}

// ── Helpers de formatação ─────────────────────────────────────────────────────
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const parts = d.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

// ── API response unwrapper ────────────────────────────────────────────────────
export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

// ── Status labels / estilos ───────────────────────────────────────────────────
export const STATUS_LABELS: Record<ContratoRecord['status'], string> = {
  ativo:     'Ativo',
  encerrado: 'Encerrado',
  suspenso:  'Suspenso',
}

export const STATUS_BADGE: Record<ContratoRecord['status'], string> = {
  ativo:     'bg-status-ok-bg text-status-ok',
  encerrado: 'bg-surface-alt text-text-secondary border border-border-subtle',
  suspenso:  'bg-status-bad-bg text-status-bad',
}

export const STATUS_DOT: Record<ContratoRecord['status'], string> = {
  ativo:     'bg-status-ok',
  encerrado: 'bg-text-faint',
  suspenso:  'bg-status-bad',
}

// ── Mock data (fallback DEV) ──────────────────────────────────────────────────
export const mockContratos: ContratoRecord[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    ossId: '11111111-1111-1111-1111-111111111111',
    numeroContrato: 'CTR-2024-001',
    periodoInicio: '2024-01-01',
    periodoFim: '2024-12-31',
    valorMensal: 150000,
    percentualDesconto: 5,
    status: 'ativo',
    createdAt: '2024-01-01T00:00:00.000Z',
    oss: { id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis', cnpj: '04.364.900/0001-79' },
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    ossId: '22222222-2222-2222-2222-222222222222',
    numeroContrato: 'CTR-2024-002',
    periodoInicio: '2024-03-01',
    periodoFim: '2025-02-28',
    valorMensal: 220000,
    percentualDesconto: null,
    status: 'ativo',
    createdAt: '2024-03-01T00:00:00.000Z',
    oss: { id: '22222222-2222-2222-2222-222222222222', nome: 'Instituto Nacional de Desenvolvimento Social e Humano', cnpj: '62.173.620/0001-80' },
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    ossId: '11111111-1111-1111-1111-111111111111',
    numeroContrato: 'CTR-2023-005',
    periodoInicio: '2023-01-01',
    periodoFim: '2023-12-31',
    valorMensal: 130000,
    percentualDesconto: 2.5,
    status: 'encerrado',
    createdAt: '2023-01-01T00:00:00.000Z',
    oss: { id: '11111111-1111-1111-1111-111111111111', nome: 'Santa Casa de Misericórdia de Cosmópolis', cnpj: '04.364.900/0001-79' },
  },
  {
    id: 'c4444444-4444-4444-4444-444444444444',
    ossId: '22222222-2222-2222-2222-222222222222',
    numeroContrato: 'CTR-2024-003',
    periodoInicio: '2024-06-01',
    periodoFim: '2025-05-31',
    valorMensal: 80000,
    percentualDesconto: 10,
    status: 'suspenso',
    createdAt: '2024-06-01T00:00:00.000Z',
    oss: { id: '22222222-2222-2222-2222-222222222222', nome: 'Instituto Nacional de Desenvolvimento Social e Humano', cnpj: '62.173.620/0001-80' },
  },
]
