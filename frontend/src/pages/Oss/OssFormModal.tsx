import { useState, useEffect, useRef } from 'react'
import { X, Building2, Loader2, AlertCircle } from 'lucide-react'
import type { OssRecord, OssFormData, OssFormErrors } from './types'
import { mascaraCNPJ, formatarCNPJ, validarCNPJ, unwrap } from './types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  /** undefined → criação; OssRecord → edição */
  oss?: OssRecord
  onSalvo: (oss: OssRecord) => void
  onFechar: () => void
}

const EMPTY: OssFormData = {
  nome: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  email: '',
  status: 'ativa',
}

// ── Field wrapper — FORA do componente pai para evitar remontagem a cada render ──
interface FieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-status-bad">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-status-bad">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  )
}

// ── CSS helper — também fora do componente ────────────────────────────────────
function inputCls(hasError?: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2 text-sm transition-colors',
    'bg-surface text-text-primary placeholder:text-text-faint',
    'focus:outline-none focus:ring-2 focus:ring-primary/40',
    hasError
      ? 'border-status-bad focus:border-status-bad'
      : 'border-border-subtle focus:border-primary',
  ].join(' ')
}

// ── DEV mock: simula respostas da API quando o backend ainda não existe ────────
function devMockSave(payload: Omit<OssRecord, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): OssRecord {
  return {
    ...payload,
    id: existingId ?? crypto.randomUUID(),
    cnpj: formatarCNPJ(payload.cnpj),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function OssFormModal({ oss, onSalvo, onFechar }: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(oss)

  const [form, setForm] = useState<OssFormData>(() =>
    oss
      ? {
          nome: oss.nome,
          cnpj: oss.cnpj,
          endereco: oss.endereco ?? '',
          telefone: oss.telefone ?? '',
          email: oss.email ?? '',
          status: oss.status,
        }
      : EMPTY,
  )
  const [erros, setErros] = useState<OssFormErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [devMockWarning, setDevMockWarning] = useState(false)

  const nomeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nomeRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onFechar])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── Field updater ─────────────────────────────────────────────────────────
  function setField<K extends keyof OssFormData>(field: K, value: OssFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErros(prev => ({ ...prev, [field]: undefined }))
    setApiError(null)
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validar(): boolean {
    const e: OssFormErrors = {}

    if (!form.nome.trim()) {
      e.nome = 'Nome é obrigatório'
    } else if (form.nome.trim().length < 3) {
      e.nome = 'Nome deve ter ao menos 3 caracteres'
    }

    if (!form.cnpj.trim()) {
      e.cnpj = 'CNPJ é obrigatório'
    } else {
      // Em edição: só valida dígitos se o CNPJ foi alterado em relação ao original
      const cnpjAlterado = !oss || form.cnpj.replace(/\D/g, '') !== oss.cnpj.replace(/\D/g, '')
      if (cnpjAlterado && !validarCNPJ(form.cnpj)) {
        e.cnpj = 'CNPJ inválido — verifique os dígitos'
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'E-mail inválido'
    }

    setErros(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.replace(/\D/g, ''),
      endereco: form.endereco.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      email: form.email.trim() || undefined,
      status: form.status,
    }

    setLoading(true)
    setApiError(null)
    setDevMockWarning(false)
    try {
      if (isEdit && oss) {
        const res = await put<OssRecord | { data: OssRecord }>(`/oss/${oss.id}`, payload)
        onSalvo(unwrap(res))
      } else {
        const res = await post<OssRecord | { data: OssRecord }>('/oss', payload)
        onSalvo(unwrap(res))
      }
    } catch (err) {
      const status  = err instanceof ApiError ? err.status : 0
      const rawMsg  = err instanceof Error   ? err.message : ''

      // ── DEV: endpoint ausente ou não autorizado → simula localmente ─────────
      const isNotFound   = status === 404 || status === 401
      const isNetworkErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')
      if (import.meta.env.DEV && (isNotFound || isNetworkErr)) {
        setDevMockWarning(true)
        onSalvo(devMockSave(payload as OssRecord, isEdit ? oss?.id : undefined))
        return
      }

      // ── Mensagens de erro em português ────────────────────────────────────
      if (status === 409 || rawMsg.toLowerCase().includes('cnpj') || rawMsg.toLowerCase().includes('unique')) {
        setErros(prev => ({ ...prev, cnpj: 'Este CNPJ já está cadastrado no sistema' }))
      } else if (status === 404) {
        setApiError('Registro não encontrado. Atualize a página e tente novamente.')
      } else if (status === 422 || status === 400) {
        setApiError(`Dados inválidos: ${rawMsg || 'verifique os campos e tente novamente.'}`)
      } else if (status === 403) {
        setApiError('Você não tem permissão para realizar esta operação.')
      } else if (status >= 500) {
        setApiError('Erro interno no servidor. Tente novamente em alguns instantes.')
      } else if (isNetworkErr) {
        setApiError('Não foi possível conectar ao servidor. Verifique sua conexão.')
      } else {
        setApiError(rawMsg || 'Erro inesperado ao salvar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oss-modal-title"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 size={20} />
            </div>
            <div>
              <h2 id="oss-modal-title" className="text-base font-semibold text-text-primary">
                {isEdit ? 'Editar Organização Social' : 'Nova Organização Social'}
              </h2>
              <p className="text-xs text-text-muted">
                {isEdit ? `ID: ${oss!.id.slice(0, 8)}…` : 'Preencha os dados da OSS'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-hover hover:text-text-secondary"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* Banner de aviso DEV — mock ativo */}
            {devMockWarning && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Modo DEV:</strong> o endpoint ainda não existe no backend.
                  Os dados foram salvos <em>localmente</em> apenas para testes —
                  nada foi persistido no banco de dados.
                </span>
              </div>
            )}

            {/* Banner de erro de API */}
            {apiError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2 text-sm text-status-bad"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Nome */}
            <Field id="oss-nome" label="Nome da Organização" required error={erros.nome}>
              <input
                ref={nomeRef}
                id="oss-nome"
                type="text"
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
                placeholder="Ex: Santa Casa de Misericórdia"
                className={inputCls(!!erros.nome)}
                aria-invalid={!!erros.nome}
                autoComplete="organization"
              />
            </Field>

            {/* CNPJ */}
            <Field id="oss-cnpj" label="CNPJ" required error={erros.cnpj}>
              <input
                id="oss-cnpj"
                type="text"
                inputMode="numeric"
                value={form.cnpj}
                onChange={e => setField('cnpj', mascaraCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                className={inputCls(!!erros.cnpj)}
                aria-invalid={!!erros.cnpj}
                maxLength={18}
                autoComplete="off"
              />
            </Field>

            {/* Endereço */}
            <Field id="oss-endereco" label="Endereço">
              <textarea
                id="oss-endereco"
                value={form.endereco}
                onChange={e => setField('endereco', e.target.value)}
                placeholder="Rua, número, bairro, cidade/UF"
                rows={2}
                className={`${inputCls()} resize-none`}
              />
            </Field>

            {/* Telefone + E-mail */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="oss-telefone" label="Telefone">
                <input
                  id="oss-telefone"
                  type="tel"
                  value={form.telefone}
                  onChange={e => setField('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  className={inputCls()}
                  autoComplete="tel"
                />
              </Field>
              <Field id="oss-email" label="E-mail" error={erros.email}>
                <input
                  id="oss-email"
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder="contato@org.org.br"
                  className={inputCls(!!erros.email)}
                  aria-invalid={!!erros.email}
                  autoComplete="email"
                />
              </Field>
            </div>

            {/* Status */}
            <Field id="oss-status" label="Status">
              <div className="flex gap-3" role="radiogroup" aria-label="Status da OSS">
                {(['ativa', 'inativa'] as const).map(s => (
                  <label
                    key={s}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      form.status === s
                        ? s === 'ativa'
                          ? 'border-status-ok bg-status-ok-bg text-status-ok'
                          : 'border-status-bad bg-status-bad-bg text-status-bad'
                        : 'border-border-subtle bg-surface text-text-muted hover:bg-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={form.status === s}
                      onChange={() => setField('status', s)}
                      className="sr-only"
                    />
                    <span
                      className={`h-2 w-2 rounded-full ${s === 'ativa' ? 'bg-status-ok' : 'bg-status-bad'}`}
                      aria-hidden="true"
                    />
                    {s === 'ativa' ? 'Ativa' : 'Inativa'}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          {/* ── Footer ── */}
          <div className="flex justify-end gap-3 border-t border-border-subtle px-6 py-4">
            <button
              type="button"
              onClick={onFechar}
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar Alterações' : 'Criar Organização'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
