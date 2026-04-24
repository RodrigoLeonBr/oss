import { useState, useEffect, useRef } from 'react'
import { X, BarChart3, Loader2, AlertCircle } from 'lucide-react'
import type { IndicadorRecord, IndicadorFormData, IndicadorFormErrors } from './types'
import { unwrap, TIPO_LABELS } from './types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  /** undefined → criação; IndicadorRecord → edição */
  indicador?: IndicadorRecord
  /** unidadeId do contexto (vem do useParams) */
  unidadeId: string
  onSalvo: (indicador: IndicadorRecord) => void
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
  payload: Omit<IndicadorRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
): IndicadorRecord {
  return {
    ...payload,
    id: existingId ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const EMPTY: IndicadorFormData = {
  nome:          '',
  descricao:     '',
  tipo:          'producao',
  metaPadrao:    '',
  unidadeMedida: '',
  vigenciaInicio: '2026-01-01',
  vigenciaFim:     '',
  prazoImplantacao: '',
  status:        'ativo',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function IndicadoresFormModal({ indicador, unidadeId, onSalvo, onFechar }: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(indicador)

  const [form, setForm] = useState<IndicadorFormData>(() =>
    indicador
      ? {
          nome:          indicador.nome,
          descricao:     indicador.descricao ?? '',
          tipo:          indicador.tipo,
          metaPadrao:    indicador.metaPadrao != null ? String(indicador.metaPadrao) : '',
          unidadeMedida: indicador.unidadeMedida ?? '',
          vigenciaInicio: indicador.vigenciaInicio ?? '2026-01-01',
          vigenciaFim:   indicador.vigenciaFim ?? '',
          prazoImplantacao: indicador.prazoImplantacao ?? '',
          status:        indicador.status,
        }
      : EMPTY,
  )
  const [erros, setErros]                   = useState<IndicadorFormErrors>({})
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

  // ── Field updater ──────────────────────────────────────────────────────────
  function setField<K extends keyof IndicadorFormData>(field: K, value: IndicadorFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErros(prev => ({ ...prev, [field]: undefined }))
    setApiError(null)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validar(): boolean {
    const e: IndicadorFormErrors = {}

    if (!form.nome.trim()) {
      e.nome = 'Nome do indicador é obrigatório'
    } else if (form.nome.trim().length < 3) {
      e.nome = 'Nome muito curto (mínimo 3 caracteres)'
    }

    if (!form.tipo) {
      e.tipo = 'Tipo é obrigatório'
    }

    const meta = parseFloat(form.metaPadrao)
    if (!form.metaPadrao.trim()) {
      e.metaPadrao = 'Meta padrão é obrigatória'
    } else if (isNaN(meta) || meta < 0) {
      e.metaPadrao = 'Meta deve ser um número ≥ 0'
    }

    if (!form.unidadeMedida.trim()) {
      e.unidadeMedida = 'Unidade de medida é obrigatória'
    }

    if (!form.vigenciaInicio.trim()) {
      e.vigenciaInicio = 'Início da vigência é obrigatório'
    }

    setErros(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    const payload = {
      unidadeId,
      nome:          form.nome.trim(),
      descricao:     form.descricao.trim() || null,
      tipo:          form.tipo,
      metaPadrao:    parseFloat(form.metaPadrao),
      unidadeMedida: form.unidadeMedida.trim(),
      vigenciaInicio: form.vigenciaInicio.trim(),
      vigenciaFim:   form.vigenciaFim.trim() || null,
      prazoImplantacao: form.prazoImplantacao.trim() || null,
      status:        form.status,
    }

    setLoading(true)
    setApiError(null)
    setDevMockWarning(false)
    try {
      if (isEdit && indicador) {
        const res = await put<IndicadorRecord | { data: IndicadorRecord }>(
          `/indicadores/${indicador.id}`,
          payload,
        )
        onSalvo(unwrap(res))
      } else {
        const res = await post<IndicadorRecord | { data: IndicadorRecord }>(
          '/indicadores',
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
            payload as Omit<IndicadorRecord, 'id' | 'createdAt' | 'updatedAt'>,
            isEdit ? indicador?.id : undefined,
          ),
        )
        return
      }

      // ── Mensagens em português ──────────────────────────────────────────────
      if (status === 401) {
        setApiError(
          'Sessão inválida ou expirada, ou o token não foi enviado. Faça login novamente (limpe o cache do site se o problema continuar) e tente de novo.',
        )
      } else if (status === 409 || rawMsg.toLowerCase().includes('nome')) {
        setErros(prev => ({ ...prev, nome: 'Já existe um indicador com este nome nesta unidade' }))
      } else if (status === 404) {
        setApiError('Indicador ou unidade não encontrado. Atualize a página e tente novamente.')
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="indicador-modal-title"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-2xl border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 id="indicador-modal-title" className="text-base font-semibold text-text-primary">
                {isEdit ? 'Editar Indicador' : 'Novo Indicador'}
              </h2>
              <p className="text-xs text-text-muted">
                {isEdit ? `ID: ${indicador!.id.slice(0, 8)}…` : 'Preencha os dados do indicador'}
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

              {/* Nome */}
              <Field
                id="indicador-nome"
                label="Nome do Indicador"
                required
                error={erros.nome}
                hint="Deve ser único dentro desta unidade"
              >
                <input
                  ref={primeiroRef}
                  id="indicador-nome"
                  type="text"
                  value={form.nome}
                  onChange={e => setField('nome', e.target.value)}
                  placeholder="Ex: Taxa de Ocupação de Leitos"
                  aria-describedby={erros.nome ? 'indicador-nome-error' : undefined}
                  className={inputCls(!!erros.nome)}
                  autoComplete="off"
                />
              </Field>

              {/* Descrição */}
              <Field
                id="indicador-descricao"
                label="Descrição"
                error={erros.descricao}
                hint="Opcional — explique o que este indicador mede"
              >
                <textarea
                  id="indicador-descricao"
                  rows={3}
                  value={form.descricao}
                  onChange={e => setField('descricao', e.target.value)}
                  placeholder="Percentual de leitos ocupados em relação ao total disponível…"
                  className={inputCls(!!erros.descricao) + ' resize-none'}
                />
              </Field>

              {/* Tipo + Unidade de Medida */}
              <div className="grid grid-cols-2 gap-4">
                <Field id="indicador-tipo" label="Tipo" required error={erros.tipo}>
                  <select
                    id="indicador-tipo"
                    value={form.tipo}
                    onChange={e => setField('tipo', e.target.value as IndicadorFormData['tipo'])}
                    aria-describedby={erros.tipo ? 'indicador-tipo-error' : undefined}
                    className={inputCls(!!erros.tipo) + ' cursor-pointer'}
                  >
                    {Object.entries(TIPO_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </Field>

                <Field
                  id="indicador-medida"
                  label="Unidade de Medida"
                  required
                  error={erros.unidadeMedida}
                  hint="Ex: %, atend., minutos"
                >
                  <input
                    id="indicador-medida"
                    type="text"
                    value={form.unidadeMedida}
                    onChange={e => setField('unidadeMedida', e.target.value)}
                    placeholder="Ex: %"
                    maxLength={50}
                    aria-describedby={erros.unidadeMedida ? 'indicador-medida-error' : undefined}
                    className={inputCls(!!erros.unidadeMedida)}
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="indicador-vigencia-ini"
                  label="Início da vigência"
                  required
                  error={erros.vigenciaInicio}
                  hint="Aplica às metas vinculadas a este indicador"
                >
                  <input
                    id="indicador-vigencia-ini"
                    type="date"
                    value={form.vigenciaInicio}
                    onChange={e => setField('vigenciaInicio', e.target.value)}
                    className={inputCls(!!erros.vigenciaInicio)}
                  />
                </Field>
                <Field
                  id="indicador-vigencia-fim"
                  label="Fim da vigência"
                  hint="Opcional — em branco = vigência aberta"
                >
                  <input
                    id="indicador-vigencia-fim"
                    type="date"
                    value={form.vigenciaFim}
                    onChange={e => setField('vigenciaFim', e.target.value)}
                    className={inputCls(false)}
                  />
                </Field>
              </div>

              <Field
                id="indicador-prazo-impl"
                label="Prazo de implantação"
                hint="Opcional — data prevista no contrato"
              >
                <input
                  id="indicador-prazo-impl"
                  type="date"
                  value={form.prazoImplantacao}
                  onChange={e => setField('prazoImplantacao', e.target.value)}
                  className={inputCls(false)}
                />
              </Field>

              {/* Meta Padrão + Status */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="indicador-meta"
                  label="Meta Padrão"
                  required
                  error={erros.metaPadrao}
                  hint="Valor numérico base (ex: 85,00)"
                >
                  <input
                    id="indicador-meta"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.metaPadrao}
                    onChange={e => setField('metaPadrao', e.target.value)}
                    placeholder="0,00"
                    aria-describedby={erros.metaPadrao ? 'indicador-meta-error' : undefined}
                    className={inputCls(!!erros.metaPadrao)}
                  />
                </Field>

                <Field id="indicador-status" label="Status">
                  <select
                    id="indicador-status"
                    value={form.status}
                    onChange={e => setField('status', e.target.value as IndicadorFormData['status'])}
                    className={inputCls(false) + ' cursor-pointer'}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </Field>
              </div>

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
              {isEdit ? 'Salvar alterações' : 'Criar indicador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
