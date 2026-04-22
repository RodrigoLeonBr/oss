import { useState, useEffect, useRef } from 'react'
import { X, Hospital, Loader2, AlertCircle } from 'lucide-react'
import type { UnidadeRecord, UnidadeFormData, UnidadeFormErrors } from './types'
import { unwrap, mascarCnesOuDoc, TIPO_LABELS, unidadeToFormData } from './types'
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

const EMPTY: UnidadeFormData = {
  contratoId: '',
  nome: '',
  sigla: '',
  endereco: '',
  cnes: '',
  tipo: 'ambulatorio',
  porte: '',
  capacidade: '',
  especialidades: '',
  responsavelTecnico: '',
  valorMensal: '',
  percentualPeso: '',
  status: 'ativa',
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
    unidade ? unidadeToFormData(unidade) : EMPTY,
  )
  const [erros, setErros]                   = useState<UnidadeFormErrors>({})
  const [loading, setLoading]               = useState(false)
  const [apiError, setApiError]             = useState<string | null>(null)

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
    if (form.sigla.trim().length > 20) {
      e.sigla = 'Máximo 20 caracteres'
    }
    if (!form.tipo) {
      e.tipo = 'Selecione o tipo de unidade'
    }
    const cap = parseInt(form.capacidade, 10)
    if (!form.capacidade.trim()) {
      e.capacidade = 'Capacidade (leitos/vagas) é obrigatória'
    } else if (isNaN(cap) || cap <= 0) {
      e.capacidade = 'Informe um valor inteiro maior que zero'
    }
    if (form.valorMensal.trim()) {
      const v = parseFloat(form.valorMensal.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (isNaN(v) || v < 0) e.valorMensal = 'Valor mensal inválido'
    }
    if (form.percentualPeso.trim()) {
      const p = parseFloat(form.percentualPeso.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (isNaN(p) || p < 0 || p > 100) e.percentualPeso = 'Use um percentual entre 0 e 100'
    }

    setErros(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    const cnesDigits = form.cnes.replace(/\D/g, '')

    const payload: Record<string, unknown> = {
      contratoId: form.contratoId,
      nome: form.nome.trim(),
      endereco: form.endereco.trim(),
      tipo: form.tipo,
      capacidade: parseInt(form.capacidade, 10),
      status: form.status,
    }
    if (form.sigla.trim()) payload.sigla = form.sigla.trim().slice(0, 20)
    if (cnesDigits) payload.cnes = cnesDigits
    if (form.porte.trim()) payload.porte = form.porte.trim()
    if (form.especialidades.trim()) payload.especialidades = form.especialidades.trim()
    if (form.responsavelTecnico.trim()) payload.responsavelTecnico = form.responsavelTecnico.trim()
    if (form.valorMensal.trim()) {
      const v = parseFloat(form.valorMensal.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (!isNaN(v) && v >= 0) payload.valorMensalUnidade = v
    }
    if (form.percentualPeso.trim()) {
      const p = parseFloat(form.percentualPeso.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (!isNaN(p) && p >= 0 && p <= 100) payload.percentualPeso = p
    }

    setLoading(true)
    setApiError(null)
    try {
      if (isEdit && unidade) {
        const res = await put<UnidadeRecord | { data: UnidadeRecord }>(`/unidades/${unidade.id}`, payload)
        onSalvo(unwrap(res))
      } else {
        const res = await post<UnidadeRecord | { data: UnidadeRecord }>('/unidades', payload)
        onSalvo(unwrap(res))
      }
    } catch (err) {
      const status  = err instanceof ApiError ? err.status : 0
      const rawMsg  = err instanceof Error   ? err.message : ''
      const isNetworkErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      // ── Mensagens em português ──────────────────────────────────────────────
      if (status === 401) {
        setApiError('Sessão inválida ou expirada. Saia e entre novamente (login) e tente de novo.')
      } else if (status === 409 || rawMsg.toLowerCase().includes('unique') || rawMsg.toLowerCase().includes('nome')) {
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
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-2xl border border-border-subtle"
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

              {/* Nome + Sigla */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
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
                </div>
                <Field
                  id="unidade-sigla"
                  label="Sigla"
                  error={erros.sigla}
                  hint="Até 20 caracteres. Vazio = gerada no servidor"
                >
                  <input
                    id="unidade-sigla"
                    type="text"
                    value={form.sigla}
                    onChange={e => setField('sigla', e.target.value.slice(0, 20))}
                    maxLength={20}
                    placeholder="Ex: UPA-CTR"
                    aria-describedby={erros.sigla ? 'unidade-sigla-error' : undefined}
                    className={inputCls(!!erros.sigla)}
                    autoComplete="off"
                  />
                </Field>
              </div>

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

              {/* CNES / CNPJ (coluna cnes) */}
              <Field
                id="unidade-cnes"
                label="CNES (7) ou CNPJ (14 dígitos)"
                error={erros.cnes}
                hint="Opcional — identificador no cadastro do Ministério da Saúde (CNES) ou CNPJ"
              >
                <input
                  id="unidade-cnes"
                  type="text"
                  inputMode="numeric"
                  value={form.cnes}
                  onChange={e => setField('cnes', mascarCnesOuDoc(e.target.value))}
                  placeholder="1234567 ou 00.000.000/0000-00"
                  maxLength={18}
                  aria-describedby={erros.cnes ? 'unidade-cnes-error' : undefined}
                  className={inputCls(!!erros.cnes)}
                  autoComplete="off"
                />
              </Field>

              {/* Tipo + Porte + Capacidade */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  id="unidade-porte"
                  label="Porte (classificação)"
                  error={erros.porte}
                  hint="Opcional — I, II, III, etc."
                >
                  <input
                    id="unidade-porte"
                    type="text"
                    value={form.porte}
                    onChange={e => setField('porte', e.target.value)}
                    placeholder="Ex: III"
                    maxLength={100}
                    className={inputCls(!!erros.porte)}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  id="unidade-capacidade"
                  label="Cap. leitos/vagas"
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

              <Field
                id="unidade-esp"
                label="Especialidades"
                error={erros.especialidades}
                hint="Opcional — separe com vírgulas (ex.: clínica médica, pediatria)"
              >
                <input
                  id="unidade-esp"
                  type="text"
                  value={form.especialidades}
                  onChange={e => setField('especialidades', e.target.value)}
                  placeholder="Ex.: clínica médica, pediatria"
                  className={inputCls(!!erros.especialidades)}
                  autoComplete="off"
                />
              </Field>

              <Field
                id="unidade-rt"
                label="Responsável técnico"
                error={erros.responsavelTecnico}
                hint="Opcional"
              >
                <input
                  id="unidade-rt"
                  type="text"
                  value={form.responsavelTecnico}
                  onChange={e => setField('responsavelTecnico', e.target.value)}
                  placeholder="Nome completo"
                  maxLength={200}
                  className={inputCls(!!erros.responsavelTecnico)}
                  autoComplete="off"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id="unidade-vmu"
                  label="Valor mensal da unidade (R$)"
                  error={erros.valorMensal}
                  hint="Opcional — usado em repasse/contrato"
                >
                  <input
                    id="unidade-vmu"
                    type="text"
                    inputMode="decimal"
                    value={form.valorMensal}
                    onChange={e => setField('valorMensal', e.target.value)}
                    placeholder="0,00"
                    className={inputCls(!!erros.valorMensal)}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  id="unidade-pp"
                  label="% Peso no contrato"
                  error={erros.percentualPeso}
                  hint="Opcional — 0 a 100"
                >
                  <input
                    id="unidade-pp"
                    type="text"
                    inputMode="decimal"
                    value={form.percentualPeso}
                    onChange={e => setField('percentualPeso', e.target.value)}
                    placeholder="0"
                    className={inputCls(!!erros.percentualPeso)}
                    autoComplete="off"
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
