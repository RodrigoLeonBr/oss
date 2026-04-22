import { useState, useEffect, useRef } from 'react'
import { X, FileText, Loader2, AlertCircle } from 'lucide-react'
import type { ContratoRecord, ContratoFormData, ContratoFormErrors } from './types'
import { unwrap } from './types'
import type { OssRecord } from '../Oss/types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  /** undefined → criação; ContratoRecord → edição */
  contrato?: ContratoRecord
  /** Lista de OSS carregada pelo componente pai (evita duplicar fetch) */
  ossList: OssRecord[]
  ossLoading: boolean
  onSalvo: (contrato: ContratoRecord) => void
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

const EMPTY: ContratoFormData = {
  ossId:              '',
  numeroContrato:     '',
  periodoInicio:      '',
  periodoFim:         '',
  valorMensal:        '',
  percentualDesconto: '',
  status:             'ativo',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ContratosFormModal({ contrato, ossList, ossLoading, onSalvo, onFechar }: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(contrato)

  const [form, setForm] = useState<ContratoFormData>(() =>
    contrato
      ? {
          ossId:              contrato.ossId,
          numeroContrato:     contrato.numeroContrato,
          periodoInicio:      contrato.periodoInicio.split('T')[0],
          periodoFim:         contrato.periodoFim.split('T')[0],
          valorMensal:        String(contrato.valorMensal),
          percentualDesconto: contrato.percentualDesconto != null
            ? String(contrato.percentualDesconto)
            : '',
          status: contrato.status,
        }
      : EMPTY,
  )
  const [erros, setErros]               = useState<ContratoFormErrors>({})
  const [loading, setLoading]           = useState(false)
  const [apiError, setApiError]         = useState<string | null>(null)

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
  function setField<K extends keyof ContratoFormData>(field: K, value: ContratoFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErros(prev => ({ ...prev, [field]: undefined }))
    setApiError(null)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validar(): boolean {
    const e: ContratoFormErrors = {}

    if (!form.ossId) {
      e.ossId = 'Selecione a OSS vinculada'
    }

    if (!form.numeroContrato.trim()) {
      e.numeroContrato = 'Número do contrato é obrigatório'
    } else if (form.numeroContrato.trim().length < 3) {
      e.numeroContrato = 'Número muito curto (mínimo 3 caracteres)'
    }

    if (!form.periodoInicio) {
      e.periodoInicio = 'Data de início é obrigatória'
    }

    if (!form.periodoFim) {
      e.periodoFim = 'Data de término é obrigatória'
    } else if (form.periodoInicio && form.periodoFim <= form.periodoInicio) {
      e.periodoFim = 'Data de término deve ser após a data de início'
    }

    const valor = parseFloat(form.valorMensal)
    if (!form.valorMensal.trim()) {
      e.valorMensal = 'Valor mensal é obrigatório'
    } else if (isNaN(valor) || valor <= 0) {
      e.valorMensal = 'Valor deve ser maior que zero'
    }

    if (form.percentualDesconto.trim()) {
      const pct = parseFloat(form.percentualDesconto)
      if (isNaN(pct) || pct < 0 || pct > 100) {
        e.percentualDesconto = 'Percentual deve estar entre 0 e 100'
      }
    }

    setErros(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    const payload = {
      ossId:              form.ossId,
      numeroContrato:     form.numeroContrato.trim(),
      periodoInicio:      form.periodoInicio,
      periodoFim:         form.periodoFim,
      valorMensal:        parseFloat(form.valorMensal),
      percentualDesconto: form.percentualDesconto.trim()
        ? parseFloat(form.percentualDesconto)
        : null,
      status: form.status,
    }

    setLoading(true)
    setApiError(null)
    try {
      if (isEdit && contrato) {
        const res = await put<ContratoRecord | { data: ContratoRecord }>(
          `/contratos/${contrato.id}`,
          payload,
        )
        onSalvo(unwrap(res))
      } else {
        const res = await post<ContratoRecord | { data: ContratoRecord }>(
          '/contratos',
          payload,
        )
        onSalvo(unwrap(res))
      }
    } catch (err) {
      const status  = err instanceof ApiError ? err.status : 0
      const rawMsg  = err instanceof Error   ? err.message : ''
      const isNetworkErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      // ── Mensagens em português ──────────────────────────────────────────────
      if (status === 409 || rawMsg.toLowerCase().includes('unique') || rawMsg.toLowerCase().includes('número')) {
        setErros(prev => ({ ...prev, numeroContrato: 'Este número de contrato já está cadastrado' }))
      } else if (status === 404) {
        setApiError('Contrato não encontrado. Atualize a página e tente novamente.')
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

  // ── OSS visíveis no dropdown ───────────────────────────────────────────────
  const ossOptions = ossList.filter(
    o => o.status === 'ativa' || (isEdit && o.id === contrato?.ossId),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contrato-modal-title"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 id="contrato-modal-title" className="text-base font-semibold text-text-primary">
                {isEdit ? 'Editar Contrato de Gestão' : 'Novo Contrato de Gestão'}
              </h2>
              <p className="text-xs text-text-muted">
                {isEdit ? `ID: ${contrato!.id.slice(0, 8)}…` : 'Preencha os dados do contrato'}
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

              {/* OSS */}
              <Field id="contrato-oss" label="Organização Social (OSS)" required error={erros.ossId}>
                <select
                  ref={primeiroRef}
                  id="contrato-oss"
                  value={form.ossId}
                  onChange={e => setField('ossId', e.target.value)}
                  disabled={ossLoading}
                  aria-describedby={erros.ossId ? 'contrato-oss-error' : undefined}
                  className={inputCls(!!erros.ossId) + ' cursor-pointer'}
                >
                  <option value="">
                    {ossLoading ? 'Carregando OSS…' : 'Selecione uma OSS…'}
                  </option>
                  {ossOptions.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.nome}{o.status === 'inativa' ? ' (inativa)' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Nº Contrato */}
              <Field
                id="contrato-numero"
                label="Número do Contrato"
                required
                error={erros.numeroContrato}
                hint="Ex: CTR-2024-001 — deve ser único"
              >
                <input
                  id="contrato-numero"
                  type="text"
                  value={form.numeroContrato}
                  onChange={e => setField('numeroContrato', e.target.value)}
                  placeholder="Ex: CTR-2024-001"
                  aria-describedby={erros.numeroContrato ? 'contrato-numero-error' : undefined}
                  className={inputCls(!!erros.numeroContrato)}
                  autoComplete="off"
                />
              </Field>

              {/* Período */}
              <div className="grid grid-cols-2 gap-4">
                <Field id="contrato-inicio" label="Início do Período" required error={erros.periodoInicio}>
                  <input
                    id="contrato-inicio"
                    type="date"
                    value={form.periodoInicio}
                    onChange={e => setField('periodoInicio', e.target.value)}
                    aria-describedby={erros.periodoInicio ? 'contrato-inicio-error' : undefined}
                    className={inputCls(!!erros.periodoInicio)}
                  />
                </Field>
                <Field id="contrato-fim" label="Fim do Período" required error={erros.periodoFim}>
                  <input
                    id="contrato-fim"
                    type="date"
                    value={form.periodoFim}
                    min={form.periodoInicio || undefined}
                    onChange={e => setField('periodoFim', e.target.value)}
                    aria-describedby={erros.periodoFim ? 'contrato-fim-error' : undefined}
                    className={inputCls(!!erros.periodoFim)}
                  />
                </Field>
              </div>

              {/* Valor + Desconto */}
              <div className="grid grid-cols-2 gap-4">
                <Field id="contrato-valor" label="Valor Mensal (R$)" required error={erros.valorMensal}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">
                      R$
                    </span>
                    <input
                      id="contrato-valor"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.valorMensal}
                      onChange={e => setField('valorMensal', e.target.value)}
                      placeholder="0,00"
                      aria-describedby={erros.valorMensal ? 'contrato-valor-error' : undefined}
                      className={inputCls(!!erros.valorMensal) + ' pl-9'}
                    />
                  </div>
                </Field>

                <Field
                  id="contrato-desconto"
                  label="% Desconto"
                  error={erros.percentualDesconto}
                  hint="Opcional — entre 0 e 100"
                >
                  <div className="relative">
                    <input
                      id="contrato-desconto"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.percentualDesconto}
                      onChange={e => setField('percentualDesconto', e.target.value)}
                      placeholder="0,00"
                      aria-describedby={erros.percentualDesconto ? 'contrato-desconto-error' : undefined}
                      className={inputCls(!!erros.percentualDesconto) + ' pr-9'}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">
                      %
                    </span>
                  </div>
                </Field>
              </div>

              {/* Status */}
              <Field id="contrato-status" label="Status">
                <select
                  id="contrato-status"
                  value={form.status}
                  onChange={e => setField('status', e.target.value as ContratoFormData['status'])}
                  className={inputCls(false) + ' cursor-pointer'}
                >
                  <option value="ativo">Ativo</option>
                  <option value="encerrado">Encerrado</option>
                  <option value="suspenso">Suspenso</option>
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
              disabled={loading || ossLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar alterações' : 'Criar contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
