import { useState, useEffect, useRef } from 'react'
import { X, Target, Loader2, AlertCircle } from 'lucide-react'
import type { MetaRecord, MetaFormData, MetaFormErrors } from './types'
import { unwrap } from './types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  meta?: MetaRecord
  indicadorId: string
  /** 'producao' → metaMensal/metaAnual fields; 'qualidade' → metaValorQualit field */
  indicadorTipo: 'producao' | 'qualidade'
  onSalvo: (meta: MetaRecord) => void
  onFechar: () => void
}

// ── Field wrapper — fora do componente pai para evitar remontagem a cada render ──
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

function devMockSave(
  payload: Omit<MetaRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
): MetaRecord {
  return {
    ...payload,
    id: existingId ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const EMPTY: MetaFormData = {
  vigenciaInicio:  '',
  vigenciaFim:     '',
  metaMensal:      '',
  metaAnual:       '',
  metaValorQualit: '',
  metaMinima:      '',
  metaParcial:     '',
  metaTipo:        'maior_igual',
  unidadeMedida:   '',
  observacoes:     '',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MetasFormModal({ meta, indicadorId, indicadorTipo, onSalvo, onFechar }: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(meta)

  const [form, setForm] = useState<MetaFormData>(() =>
    meta
      ? {
          vigenciaInicio:  meta.vigenciaInicio,
          vigenciaFim:     meta.vigenciaFim ?? '',
          metaMensal:      meta.metaMensal != null ? String(meta.metaMensal) : '',
          metaAnual:       meta.metaAnual != null ? String(meta.metaAnual) : '',
          metaValorQualit: meta.metaValorQualit != null ? String(meta.metaValorQualit) : '',
          metaMinima:      meta.metaMinima != null ? String(meta.metaMinima) : '',
          metaParcial:     meta.metaParcial != null ? String(meta.metaParcial) : '',
          metaTipo:        meta.metaTipo ?? 'maior_igual',
          unidadeMedida:   meta.unidadeMedida ?? '',
          observacoes:     meta.observacoes ?? '',
        }
      : EMPTY,
  )
  const [erros, setErros]                   = useState<MetaFormErrors>({})
  const [loading, setLoading]               = useState(false)
  const [apiError, setApiError]             = useState<string | null>(null)
  const [devMockWarning, setDevMockWarning] = useState(false)

  const primeiroRef = useRef<HTMLInputElement>(null)

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

  function setField<K extends keyof MetaFormData>(field: K, value: MetaFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErros(prev => ({ ...prev, [field]: undefined }))
    setApiError(null)
  }

  function validar(): boolean {
    const e: MetaFormErrors = {}

    if (!form.vigenciaInicio) {
      e.vigenciaInicio = 'Data de início da vigência é obrigatória'
    }

    const isProducao = indicadorTipo === 'producao'
    const isQualidade = indicadorTipo === 'qualidade'

    if (isProducao) {
      const mensal = form.metaMensal.trim() ? parseFloat(form.metaMensal) : null
      const anual  = form.metaAnual.trim()  ? parseFloat(form.metaAnual)  : null
      if (mensal === null && anual === null) {
        e.metaMensal = 'Informe ao menos meta mensal ou anual'
      } else {
        if (mensal !== null && (isNaN(mensal) || mensal < 0)) e.metaMensal = 'Valor deve ser ≥ 0'
        if (anual  !== null && (isNaN(anual)  || anual  < 0)) e.metaAnual  = 'Valor deve ser ≥ 0'
      }
    }

    if (isQualidade) {
      const qualit = form.metaValorQualit.trim() ? parseFloat(form.metaValorQualit) : null
      if (qualit === null) {
        e.metaValorQualit = 'Meta de qualidade é obrigatória'
      } else if (isNaN(qualit) || qualit < 0) {
        e.metaValorQualit = 'Valor deve ser ≥ 0'
      }
    }

    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validar()) return

    const toNum = (s: string) => s.trim() ? parseFloat(s) : null

    const payload = {
      indicadorId,
      vigenciaInicio:  form.vigenciaInicio,
      vigenciaFim:     form.vigenciaFim  || null,
      metaMensal:      toNum(form.metaMensal),
      metaAnual:       toNum(form.metaAnual),
      metaValorQualit: toNum(form.metaValorQualit),
      metaMinima:      toNum(form.metaMinima),
      metaParcial:     toNum(form.metaParcial),
      metaTipo:        form.metaTipo,
      unidadeMedida:   form.unidadeMedida.trim() || null,
      observacoes:     form.observacoes.trim()   || null,
    }

    setLoading(true)
    setApiError(null)
    setDevMockWarning(false)
    try {
      if (isEdit && meta) {
        const res = await put<MetaRecord | { data: MetaRecord }>(`/metas/${meta.id}`, payload)
        onSalvo(unwrap(res))
      } else {
        const res = await post<MetaRecord | { data: MetaRecord }>('/metas', payload)
        onSalvo(unwrap(res))
      }
    } catch (err) {
      const status   = err instanceof ApiError ? err.status : 0
      const rawMsg   = err instanceof Error   ? err.message : ''
      const isNetErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      if (import.meta.env.DEV && (status === 401 || status === 404 || isNetErr)) {
        setDevMockWarning(true)
        const mockRecord: Omit<MetaRecord, 'id' | 'createdAt' | 'updatedAt'> = {
          ...payload,
          versao: meta?.versao ?? 1,
          status: payload.vigenciaFim ? 'encerrada' : 'vigente',
          prazoImplantacao: null,
        }
        onSalvo(devMockSave(mockRecord, isEdit ? meta?.id : undefined))
        return
      }

      if (status === 409) {
        setApiError('Já existe uma meta vigente para este indicador. Encerre a meta atual antes de criar uma nova.')
      } else if (status === 400 || status === 422) {
        setApiError(`Dados inválidos: ${rawMsg || 'verifique os campos e tente novamente.'}`)
      } else if (status === 403) {
        setApiError('Você não tem permissão para realizar esta operação.')
      } else if (status >= 500) {
        setApiError('Erro interno no servidor. Tente novamente em alguns instantes.')
      } else if (isNetErr) {
        setApiError('Não foi possível conectar ao servidor. Verifique sua conexão.')
      } else {
        setApiError(rawMsg || 'Erro inesperado ao salvar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isProducao  = indicadorTipo === 'producao'
  const isQualidade = indicadorTipo === 'qualidade'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-modal-title"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target size={20} />
            </div>
            <div>
              <h2 id="meta-modal-title" className="text-base font-semibold text-text-primary">
                {isEdit ? 'Editar Meta' : 'Nova Meta'}
              </h2>
              <p className="text-xs text-text-muted">
                {isEdit ? `Versão ${meta!.versao} · ID: ${meta!.id.slice(0, 8)}…` : 'Preencha os dados da meta anual'}
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

              {devMockWarning && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Modo DEV:</strong> endpoint ausente. Dados salvos <em>localmente</em> —
                    nada foi persistido no banco de dados.
                  </span>
                </div>
              )}

              {apiError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2 text-sm text-status-bad"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {/* Vigência */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="meta-inicio"
                  label="Início da Vigência"
                  required
                  error={erros.vigenciaInicio}
                >
                  <input
                    ref={primeiroRef}
                    id="meta-inicio"
                    type="date"
                    value={form.vigenciaInicio}
                    onChange={e => setField('vigenciaInicio', e.target.value)}
                    aria-describedby={erros.vigenciaInicio ? 'meta-inicio-error' : undefined}
                    className={inputCls(!!erros.vigenciaInicio)}
                  />
                </Field>

                <Field
                  id="meta-fim"
                  label="Fim da Vigência"
                  hint="Deixe em branco para vigência aberta"
                >
                  <input
                    id="meta-fim"
                    type="date"
                    value={form.vigenciaFim}
                    onChange={e => setField('vigenciaFim', e.target.value)}
                    className={inputCls(false)}
                  />
                </Field>
              </div>

              {/* Campos de produção */}
              {isProducao && (
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    id="meta-mensal"
                    label="Meta Mensal"
                    required
                    error={erros.metaMensal}
                    hint="Informe mensal ou anual"
                  >
                    <input
                      id="meta-mensal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.metaMensal}
                      onChange={e => setField('metaMensal', e.target.value)}
                      placeholder="0,00"
                      aria-describedby={erros.metaMensal ? 'meta-mensal-error' : undefined}
                      className={inputCls(!!erros.metaMensal)}
                    />
                  </Field>

                  <Field
                    id="meta-anual"
                    label="Meta Anual"
                    error={erros.metaAnual}
                    hint="Calculada automaticamente se vazio"
                  >
                    <input
                      id="meta-anual"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.metaAnual}
                      onChange={e => setField('metaAnual', e.target.value)}
                      placeholder="0,00"
                      aria-describedby={erros.metaAnual ? 'meta-anual-error' : undefined}
                      className={inputCls(!!erros.metaAnual)}
                    />
                  </Field>
                </div>
              )}

              {/* Campo de qualidade */}
              {isQualidade && (
                <Field
                  id="meta-qualit"
                  label="Meta de Qualidade"
                  required
                  error={erros.metaValorQualit}
                  hint="Ex: tempo máximo em minutos, percentual aceitável"
                >
                  <input
                    id="meta-qualit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.metaValorQualit}
                    onChange={e => setField('metaValorQualit', e.target.value)}
                    placeholder="0,00"
                    aria-describedby={erros.metaValorQualit ? 'meta-qualit-error' : undefined}
                    className={inputCls(!!erros.metaValorQualit)}
                  />
                </Field>
              )}

              {/* Tipo de meta */}
              <Field id="metaTipo" label="Tipo de meta" required>
                <select
                  id="metaTipo"
                  value={form.metaTipo}
                  onChange={e => setField('metaTipo', e.target.value as MetaFormData['metaTipo'])}
                  className={inputCls(false)}
                >
                  <option value="maior_igual">↑ Maior ou igual (mais é melhor)</option>
                  <option value="menor_igual">↓ Menor ou igual (menos é melhor)</option>
                </select>
              </Field>

              {/* Meta mínima + parcial */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="meta-minima"
                  label={
                    form.metaTipo === 'menor_igual'
                      ? 'Limite atingido (x) — atingido abaixo deste valor'
                      : 'Limite mínimo (x) — não atingido abaixo deste valor'
                  }
                >
                  <input
                    id="meta-minima"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.metaMinima}
                    onChange={e => setField('metaMinima', e.target.value)}
                    placeholder="0,00"
                    className={inputCls(false)}
                  />
                </Field>

                {isProducao && (
                  <Field
                    id="meta-parcial"
                    label={
                      form.metaTipo === 'menor_igual'
                        ? 'Limite parcial (y) — parcialmente atingido entre y e x'
                        : 'Limite parcial (y) — parcialmente atingido entre x e y'
                    }
                  >
                    <input
                      id="meta-parcial"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.metaParcial}
                      onChange={e => setField('metaParcial', e.target.value)}
                      placeholder="0,00"
                      className={inputCls(false)}
                    />
                  </Field>
                )}
              </div>

              {/* Unidade de medida */}
              <Field
                id="meta-medida"
                label="Unidade de Medida"
                error={erros.unidadeMedida}
                hint="Ex: atendimentos, %, minutos"
              >
                <input
                  id="meta-medida"
                  type="text"
                  value={form.unidadeMedida}
                  onChange={e => setField('unidadeMedida', e.target.value)}
                  placeholder="Ex: atendimentos"
                  maxLength={50}
                  className={inputCls(!!erros.unidadeMedida)}
                  autoComplete="off"
                />
              </Field>

              {/* Observações */}
              <Field
                id="meta-obs"
                label="Observações"
                hint="Opcional — justificativa ou contexto desta meta"
              >
                <textarea
                  id="meta-obs"
                  rows={3}
                  value={form.observacoes}
                  onChange={e => setField('observacoes', e.target.value)}
                  placeholder="Descreva mudanças em relação à meta anterior, contexto contratual…"
                  className={inputCls(false) + ' resize-none'}
                />
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
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar alterações' : 'Criar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
