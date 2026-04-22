export interface OssRecord {
  id: string
  nome: string
  cnpj: string
  endereco?: string
  telefone?: string
  email?: string
  status: 'ativa' | 'inativa'
  createdAt?: string
  updatedAt?: string
}

export interface OssFormData {
  nome: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
  status: 'ativa' | 'inativa'
}

export interface OssFormErrors {
  nome?: string
  cnpj?: string
  email?: string
}

// ── CNPJ helpers ─────────────────────────────────────────────────────────────

export function mascaraCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return false
  if (/^(\d)\1+$/.test(d)) return false

  const calc = (len: number): number => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0)
    const rem = sum % 11
    return rem < 2 ? 0 : 11 - rem
  }

  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13])
}

export function formatarCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// ── API response unwrapper ────────────────────────────────────────────────────
export function unwrap<T>(res: T | { data: T }): T {
  if (res && typeof res === 'object' && 'data' in (res as object)) {
    return (res as { data: T }).data
  }
  return res as T
}

// ── Mock data (DEV fallback) ──────────────────────────────────────────────────
// CNPJs gerados com dígitos verificadores válidos para uso em testes
export const mockOssRecords: OssRecord[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    nome: 'Santa Casa de Misericórdia de Cosmópolis',
    cnpj: '04.364.900/0001-79',
    endereco: 'Rua XV de Novembro, 300 – Centro, Cosmópolis/SP',
    telefone: '(19) 3877-1200',
    email: 'contato@scmc.org.br',
    status: 'ativa',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    nome: 'Instituto Nacional de Desenvolvimento Social e Humano',
    cnpj: '62.173.620/0001-80',
    endereco: 'Av. Paulista, 1000 – Bela Vista, São Paulo/SP',
    telefone: '(11) 3000-0001',
    email: 'contato@indsh.org.br',
    status: 'ativa',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]
