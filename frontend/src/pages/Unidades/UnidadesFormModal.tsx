import { useState, useEffect, useRef } from 'react'
import { X, Hospital, Loader2, AlertCircle } from 'lucide-react'
import type { UnidadeRecord, UnidadeFormData, UnidadeFormErrors } from './types'
import { unwrap, mascaraCNPJUnidade, TIPO_LABELS } from './types'
import type { ContratoRecord } from '../Contratos/types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  /** undefined → criação; UnidadeRecord → edição */
  unidade?: UnidadeRecord
  /** Lista de contratos carregada pelo componente pai (evita duplicar fetch) */
  contratosList: ContratoRecord[]
  contratosLoading: boolean
  onSalvo: (unidade: UnidadeRecord) => void
  onFechar: () => void
}

// ── Field wrapper — FORA do componente pai para evitar remontagem a cada render ──
interface FieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

function Field({ id, label, required, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="ml-1 text-status-bad" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && (
        <p role="alert" id={`${id}-error`} className="flex items-center gap-1 text-xs text-status-bad">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border px-3 py-2.5 text-sm text-text-primary bg-surface',
    'placeholder:text-text-faint',
    'focus:outline-none focus:ring-2 focus:ring-primary/40',
    'transition-colors',
    hasError
      ? 'border-status-bad focus:border-status-bad'
      : 'border-border-subtle focus:border-primary',
  ].join(' ')
}

// ── DEV mock: simula API quando o backend ainda não existe ────────────────────
function devMockSave(
  payload: Omit<UnidadeRecord, 'id' | 'createdAt' | 'updatedAt'>,
  contratosList: ContratoRecord[],
  existingId?: string,
): UnidadeRecord {
  const contrato = contratosList.find(c => c.id === payload.contratoId)
  return {
    ...payload,
    id: existingId ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contrato: contrato
      ? {
          id: contrato.id,
          numeroContrato: contrato.numeroContrato,
          oss: contrato.oss ? { id: contrato.oss.id, nome: contrato.oss.nome } : undefined,
        }
      : undefined,
  }
}

const EMPTY: UnidadeFormData = {
  contratoId: '',
  nome:        '',
  endereco:    '',
  cnpj:        '',
  tipo:        'ambulatorio',
  capacidade:  '',
  status:      'ativa',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function UnidadesFormModal({
  unidade,
  contratosList,
  contratosLoading,
  onSalvo,
  onFechar,
}: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(unidade)

  const [form, setForm] = useState<UnidadeFormData>(() =>
    unidade
      ? {
          contratoId: unidade.contratoId,
          nome:       unidade.nome,
          endereco:   unidade.endereco,
          cnpj:       unidade.cnpj ?? '',
          tipo:       unidade.tipo,
          capacidade: String(unidade.capacidade),
          status:     unidade.status,
        }
      : EMPTY,
  )
  const [erros, setErros]                   = useState<UnidadeFormErrors>({})
  const [loading, setLoading]               = useState(false)
  const [apiError, setApiError]             = useState<string | null>(null)
  const [devMockWarning, setDevMockWarning] = useState(false)

  const primeiroRef = useRef<HTMLSelectElement>(null)

  useEffect(() => { primeiroRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onFechar])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── Field updater ──────────────────────────────────────────────────────────
  function setField<K extends keyof UnidadeFormData>(field: K, value: UnidadeFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErros(prev => ({ ...prev, [field]: undefined }))
    setApiError(null)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validar(): boolean {
    const e: UnidadeFormErrors = {}

    if (!form.contratoId) {
      e.contratoId = 'Selecione o contrato vinculado'
    }
    if (!form.nome.trim()) {
      e.nome = 'Nome da unidade é obrigatório'
    } else if (form.nome.trim().length < 3) {
      e.nome = 'Nome muito curto (mínimo 3 caracteres)'
    }
    if (!form.endereco.trim()) {
      e.endereco = 'Endereço é obrigatório'
    }
    if (!form.tipo) {
      e.tipo = 'Selecione o tipo de unidade'
    }
    const cap = parseInt(form.capacidade, 10)
    if (!form.capacidade.trim()) {
      e.capacidade = 'Capacidade é obrigatória'
    } else if (isNaN(cap) || cap <= 0) {
      e.capacidade = 'Capacidade deve ser maior que zero'
    }

    setErros(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    const payload = {
      contratoId: form.contratoId,
      nome:       form.nome.trim(),
      endereco:   form.endereco.trim(),
      cnpj:       form.cnpj.trim() || null,
      tipo:       form.tipo,
      capacidade: parseInt(form.capacidade, 10),
      status:     form.status,
    }

    setLoading(true)
    setApiError(null)
    setDevMockWarning(false)
    try {
      if (isEdit && unidade) {
        const res = await put<UnidadeRecord | { data: UnidadeRecord }>(
          `/unidades/${unidade.id}`,
          payload,
        )
        onSalvo(unwrap(res))
      } else {
        const res = await post<UnidadeRecord | { data: UnidadeRecord }>(
          '/unidades',
          payload,
        )
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
        onSalvo(
          devMockSave(
            payload as Omit<UnidadeRecord, 'id' | 'createdAt' | 'updatedAt'>,
            contratosList,
            isEdit ? unidade?.id : undefined,
          ),
        )
        return
      }

      // ── Mensagens em português ──────────────────────────────────────────────
      if (status === 409 || rawMsg.toLowerCase().includes('unique') || rawMsg.toLowerCase().includes('nome')) {
        setErros(prev => ({ ...prev, nome: 'Já existe uma unidade com este nome neste contrato' }))
      } else if (status === 404) {
        setApiError('Unidade não encontrada. Atualize a página e tente novamente.')
      } else if (status === 400 || status === 422) {
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

  // ── Contratos visíveis no dropdown ─────────────────────────────────────────
  const contratosOptions = contratosList.filter(
    c => c.status === 'ativo' || (isEdit && c.id === unidade?.contratoId),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unidade-modal-title"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hospital size={20} />
            </div>
            <div>
              <h2 id="unidade-modal-title" className="text-base font-semibold text-text-primary">
                {isEdit ? 'Editar Unidade de Saúde' : 'Nova Unidade de Saúde'}
              </h2>
              <p className="text-xs text-text-muted">
                {isEdit ? `ID: ${unidade!.id.slice(0, 8)}…` : 'Preencha os dados da unidade'}
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
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="space-y-4">

              {/* Banner DEV */}
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

              {/* Banner erro API */}
              {apiError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2 text-sm text-status-bad"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Contrato */}
              <Field id="unidade-contrato" label="Contrato de Gestão" required error={erros.contratoId}>
                <select
                  ref={primeiroRef}
                  id="unidade-contrato"
                  value={form.contratoId}
                  onChange={e => setField('contratoId', e.target.value)}
                  disabled={contratosLoading}
                  aria-describedby={erros.contratoId ? 'unidade-contrato-error' : undefined}
                  className={inputCls(!!erros.contratoId) + ' cursor-pointer'}
                >
                  <option value="">
                    {contratosLoading ? 'Carregando contratos…' : 'Selecione um contrato…'}
                  </option>
                  {contratosOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.numeroContrato}
                      {c.oss ? ` — ${c.oss.nome}` : ''}
                      {c.status !== 'ativo' ? ` (${c.status})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Nome */}
              <Field
                id="unidade-nome"
                label="Nome da Unidade"
                required
                error={erros.nome}
                hint="Ex: UPA 24h Centro, Hospital Municipal de Americana"
              >
                <input
                  id="unidade-nome"
                  type="text"
                  value={form.nome}
                  onChange={e => setField('nome', e.target.value)}
                  placeholder="Ex: UPA 24h Centro"
                  aria-describedby={erros.nome ? 'unidade-nome-error' : undefined}
                  className={inputCls(!!erros.nome)}
                  autoComplete="off"
                />
              </Field>

              {/* Endereço */}
              <Field id="unidade-endereco" label="Endereço" required error={erros.endereco}>
                <textarea
                  id="unidade-endereco"
                  rows={2}
                  value={form.endereco}
                  onChange={e => setField('endereco', e.target.value)}
                  placeholder="Rua, número – Bairro, Cidade/UF"
                  aria-describedby={erros.endereco ? 'unidade-endereco-error' : undefined}
                  className={inputCls(!!erros.endereco) + ' resize-none'}
                />
              </Field>

              {/* CNPJ */}
              <Field
                id="unidade-cnpj"
                label="CNPJ"
                error={erros.cnpj}
                hint="Opcional — formato: 00.000.000/0000-00"
              >
                <input
                  id="unidade-cnpj"
                  type="text"
                  inputMode="numeric"
                  value={form.cnpj}
                  onChange={e => setField('cnpj', mascaraCNPJUnidade(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  aria-describedby={erros.cnpj ? 'unidade-cnpj-error' : undefined}
                  className={inputCls(!!erros.cnpj)}
                  autoComplete="off"
                />
              </Field>

              {/* Tipo + Capacidade */}
              <div className="grid grid-cols-2 gap-4">
                <Field id="unidade-tipo" label="Tipo" required error={erros.tipo}>
                  <select
                    id="unidade-tipo"
                    value={form.tipo}
                    onChange={e => setField('tipo', e.target.value as UnidadeFormData['tipo'])}
                    aria-describedby={erros.tipo ? 'unidade-tipo-error' : undefined}
                    className={inputCls(!!erros.tipo) + ' cursor-pointer'}
                  >
                    {Object.entries(TIPO_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </Field>

                <Field
                  id="unidade-capacidade"
                  label="Capacidade (leitos/vagas)"
                  required
                  error={erros.capacidade}
                >
                  <input
                    id="unidade-capacidade"
                    type="number"
                    min="1"
                    step="1"
                    value={form.capacidade}
                    onChange={e => setField('capacidade', e.target.value)}
                    placeholder="Ex: 120"
                    aria-describedby={erros.capacidade ? 'unidade-capacidade-error' : undefined}
                    className={inputCls(!!erros.capacidade)}
                  />
                </Field>
              </div>

              {/* Status */}
              <Field id="unidade-status" label="Status">
                <select
                  id="unidade-status"
                  value={form.status}
                  onChange={e => setField('status', e.target.value as UnidadeFormData['status'])}
                  className={inputCls(false) + ' cursor-pointer'}
                >
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </select>
              </Field>

            </div>
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
              disabled={loading || contratosLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar alterações' : 'Criar unidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
