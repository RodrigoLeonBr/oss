import { useState, useEffect } from 'react'
import { X, Target, Loader2, AlertCircle, Plus, Trash2, Layers, CircleDot } from 'lucide-react'
import type { MetaRecord, MetaFormData, MetaFormErrors, MetaPacoteComponenteForm } from './types'
import { emptyComponente, unwrap, formatarData } from './types'
import { useApi, ApiError } from '../../hooks/useApi'

interface Props {
  meta?: MetaRecord
  indicadorId: string
  /** 'producao' → metaMensal/metaAnual fields; 'qualidade' → metaValorQualit field */
  indicadorTipo: 'producao' | 'qualidade'
  /** Vigência e prazo definidos no cadastro do indicador */
  indicadorVigencia: {
    vigenciaInicio: string | null
    vigenciaFim: string | null
    prazoImplantacao: string | null
  } | null
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
  nome:            '',
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

const SUM_TOL = 1e-4

export default function MetasFormModal({
  meta,
  indicadorId,
  indicadorTipo,
  indicadorVigencia,
  onSalvo,
  onFechar,
}: Props) {
  const { post, put } = useApi()
  const isEdit = Boolean(meta)
  const isProducao = indicadorTipo === 'producao'
  const isQualidade = indicadorTipo === 'qualidade'
  const [modo, setModo] = useState<'simples' | 'pacote'>(() => 'simples')
  const pacoteAtivo = !isEdit && isProducao && modo === 'pacote'
  const [componentes, setComponentes] = useState<MetaPacoteComponenteForm[]>([
    emptyComponente(),
    emptyComponente(),
  ])

  const [form, setForm] = useState<MetaFormData>(() =>
    meta
      ? {
          nome:            meta.nome?.trim() || meta.observacoes?.trim() || '',
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

  useEffect(() => {
    document.getElementById('meta-nome')?.focus()
  }, [])

  useEffect(() => {
    if (!meta && isProducao) {
      setModo('simples')
      setComponentes([emptyComponente(), emptyComponente()])
    }
  }, [meta, isProducao, indicadorId])

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

  function setComponente(
    i: number,
    field: keyof MetaPacoteComponenteForm,
    value: string,
  ) {
    setComponentes(prev => {
      const n = [...prev]
      n[i] = { ...n[i], [field]: value }
      return n
    })
    setApiError(null)
  }

  function addComponente() {
    setComponentes(prev => [...prev, emptyComponente()])
  }

  function removeComponente(i: number) {
    setComponentes(prev => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))
  }

  function validar(): boolean {
    const e: MetaFormErrors = {}

    if (!indicadorVigencia?.vigenciaInicio) {
      e.indicadorVigencia = 'Defina início da vigência no cadastro do indicador.'
    }

    if (!form.nome.trim()) {
      e.nome = 'Informe o nome da meta'
    }

    if (pacoteAtivo) {
      for (let i = 0; i < componentes.length; i++) {
        if (!componentes[i].nome.trim()) {
          e.metaMensal = `Nome obrigatório em cada componente (linha ${i + 1}).`
          break
        }
      }
    }

    const chkPct = (s: string, err: 'metaMinima' | 'metaParcial') => {
      if (!s.trim()) return
      const x = parseFloat(s.replace(',', '.'))
      if (isNaN(x) || x < 0 || x > 100) e[err] = 'Use percentual entre 0 e 100'
    }
    chkPct(form.metaMinima, 'metaMinima')
    chkPct(form.metaParcial, 'metaParcial')
    if (pacoteAtivo) {
      for (let i = 0; i < componentes.length; i++) {
        const c = componentes[i]
        for (const [label, val] of [['Mín', c.metaMinima], ['Parc', c.metaParcial]] as const) {
          if (!val.trim()) continue
          const x = parseFloat(val.replace(',', '.'))
          if (isNaN(x) || x < 0 || x > 100) {
            e.metaMensal = `Componente ${i + 1}: ${label} — use percentual 0–100.`
            break
          }
        }
        if (e.metaMensal) break
      }
    }

    if (isProducao && !pacoteAtivo) {
      const mensal = form.metaMensal.trim() ? parseFloat(form.metaMensal) : null
      const anual  = form.metaAnual.trim()  ? parseFloat(form.metaAnual)  : null
      if (mensal === null && anual === null) {
        e.metaMensal = 'Informe ao menos meta mensal ou anual'
      } else {
        if (mensal !== null && (isNaN(mensal) || mensal < 0)) e.metaMensal = 'Valor deve ser ≥ 0'
        if (anual  !== null && (isNaN(anual)  || anual  < 0)) e.metaAnual  = 'Valor deve ser ≥ 0'
      }
    }

    if (pacoteAtivo) {
      const ag = form.metaMensal.trim() ? parseFloat(form.metaMensal) : null
      if (ag === null || isNaN(ag) || ag < 0) {
        e.metaMensal = 'Informe a meta mensal total (soma de referência)'
      }
      let sum = 0
      for (const c of componentes) {
        const m = c.metaMensal.trim() ? parseFloat(c.metaMensal) : NaN
        const w = c.peso.trim() ? parseFloat(c.peso) : NaN
        if (isNaN(m) || m < 0) {
          e.metaMensal = 'Cada componente precisa de meta mensal válida (≥ 0).'
          break
        }
        if (isNaN(w) || w <= 0) {
          e.metaMensal = 'Cada componente precisa de peso > 0.'
          break
        }
        sum += m
      }
      if (!e.metaMensal && ag !== null && !isNaN(ag) && Math.abs(sum - ag) > SUM_TOL) {
        e.metaMensal = `Soma dos componentes (${sum.toFixed(4)}) deve igualar a meta total (${ag.toFixed(4)}).`
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

    const common = {
      nome:            form.nome.trim(),
      metaMensal:      toNum(form.metaMensal),
      metaAnual:       toNum(form.metaAnual),
      metaValorQualit: toNum(form.metaValorQualit),
      metaMinima:      toNum(form.metaMinima),
      metaParcial:     toNum(form.metaParcial),
      metaTipo:        form.metaTipo,
      unidadeMedida:   form.unidadeMedida.trim() || null,
      observacoes:     form.observacoes.trim()   || null,
    }

    const payload = { indicadorId, ...common }
    const pacoteBody = {
      indicadorId,
      agregada: {
        nome:           form.nome.trim(),
        metaMensal:     toNum(form.metaMensal) as number,
        metaAnual:      toNum(form.metaAnual),
        metaTipo:       form.metaTipo,
        observacoes:    form.observacoes.trim() || null,
        metaMinima:     toNum(form.metaMinima),
        metaParcial:    toNum(form.metaParcial),
        unidadeMedida:  form.unidadeMedida.trim() || null,
      },
      componentes: componentes.map(c => ({
        nome:         c.nome.trim(),
        metaMensal:   toNum(c.metaMensal) as number,
        metaAnual:    c.metaAnual.trim() ? toNum(c.metaAnual) : null,
        peso:         toNum(c.peso) as number,
        observacoes:  c.observacoes.trim() || null,
        metaMinima:   c.metaMinima.trim() ? toNum(c.metaMinima) : null,
        metaParcial:  c.metaParcial.trim() ? toNum(c.metaParcial) : null,
        metaTipo:     form.metaTipo,
      })),
    }

    setLoading(true)
    setApiError(null)
    setDevMockWarning(false)
    const criarPacote = !isEdit && isProducao && modo === 'pacote'
    try {
      if (isEdit && meta) {
        const res = await put<MetaRecord | { data: MetaRecord }>(`/metas/${meta.id}`, payload)
        onSalvo(unwrap(res))
      } else if (criarPacote) {
        const res = await post<MetaRecord | { data: MetaRecord }>('/metas/pacote', pacoteBody)
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
        if (criarPacote) {
          const ag = toNum(form.metaMensal) as number
          const st: MetaRecord['status'] = indicadorVigencia?.vigenciaFim ? 'encerrada' : 'vigente'
          const base: Omit<MetaRecord, 'id' | 'createdAt' | 'updatedAt' | 'children'> = {
            ...payload,
            versao: meta?.versao ?? 1,
            status: st,
            vigenciaInicio: indicadorVigencia?.vigenciaInicio ?? null,
            vigenciaFim: indicadorVigencia?.vigenciaFim ?? null,
            prazoImplantacao: indicadorVigencia?.prazoImplantacao ?? null,
            papel: 'agregada',
            parentMetaId: null,
            peso: null,
            metaMensal: ag,
            nome: form.nome.trim(),
          }
          const parent = devMockSave(base)
          const children: MetaRecord[] = componentes.map(c =>
            devMockSave({
              ...payload,
              indicadorId,
              versao: parent.versao,
              status: parent.status,
              vigenciaInicio: indicadorVigencia?.vigenciaInicio ?? null,
              vigenciaFim: indicadorVigencia?.vigenciaFim ?? null,
              prazoImplantacao: indicadorVigencia?.prazoImplantacao ?? null,
              papel: 'componente',
              parentMetaId: parent.id,
              metaMensal: toNum(c.metaMensal) as number,
              metaAnual:  c.metaAnual.trim() ? toNum(c.metaAnual) : (toNum(c.metaMensal) as number) * 12,
              peso: toNum(c.peso) as number,
              nome: c.nome.trim(),
              observacoes: c.observacoes.trim() || null,
            }),
          )
          onSalvo({ ...parent, children })
          return
        }
        const mockRecord: Omit<MetaRecord, 'id' | 'createdAt' | 'updatedAt'> = {
          ...payload,
          nome: form.nome.trim(),
          versao: meta?.versao ?? 1,
          status: indicadorVigencia?.vigenciaFim ? 'encerrada' : 'vigente',
          vigenciaInicio: indicadorVigencia?.vigenciaInicio ?? null,
          vigenciaFim: indicadorVigencia?.vigenciaFim ?? null,
          prazoImplantacao: indicadorVigencia?.prazoImplantacao ?? null,
        }
        onSalvo(devMockSave(mockRecord, isEdit ? meta?.id : undefined))
        return
      }

      if (status === 401) {
        setApiError(
          'Sessão inválida ou expirada, ou o token não foi enviado. Faça login novamente e tente de novo.',
        )
      } else if (status === 409) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-modal-title"
    >
      <div
        className={`w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl ${
          !isEdit && isProducao && modo === 'pacote' ? 'max-w-2xl' : 'max-w-lg'
        }`}
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

              {!isEdit && isProducao && (
                <div className="flex gap-1 rounded-xl border border-border-subtle bg-surface-alt/50 p-1">
                  <button
                    type="button"
                    onClick={() => { setModo('simples'); setApiError(null) }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      modo === 'simples'
                        ? 'bg-surface text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <CircleDot size={16} />
                    Meta avulsa
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModo('pacote'); setApiError(null) }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      modo === 'pacote'
                        ? 'bg-surface text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Layers size={16} />
                    Decomposição
                  </button>
                </div>
              )}

              {modo === 'pacote' && !isEdit && isProducao && (
                <p className="text-xs text-text-muted">
                  A <strong>meta mensal total</strong> é a soma de referência; cada linha abaixo é um componente com peso para a média ponderada F.
                </p>
              )}

              <Field
                id="meta-nome"
                label={pacoteAtivo ? 'Nome do pacote (agregada)' : 'Nome da meta'}
                required
                error={erros.nome}
                hint="Primeiro preencha o nome; em decomposição, cada componente também tem nome obrigatório abaixo."
              >
                <input
                  id="meta-nome"
                  type="text"
                  value={form.nome}
                  onChange={e => setField('nome', e.target.value)}
                  placeholder="Ex.: Produção SADT — consultas"
                  maxLength={500}
                  autoComplete="off"
                  className={inputCls(!!erros.nome)}
                />
              </Field>

              <div
                className="rounded-xl border border-border-subtle bg-surface-alt/50 px-3 py-3 text-sm"
                aria-label="Vigência e prazo do indicador"
              >
                <p className="mb-2 font-medium text-text-secondary">Vigência e prazo (cadastro do indicador)</p>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-text-muted">Início da vigência</dt>
                    <dd className="text-text-primary">{formatarData(indicadorVigencia?.vigenciaInicio)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Fim da vigência</dt>
                    <dd className="text-text-primary">
                      {indicadorVigencia?.vigenciaFim
                        ? formatarData(indicadorVigencia.vigenciaFim)
                        : <span className="text-status-ok">em vigor</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Prazo de implantação</dt>
                    <dd className="text-text-primary">{formatarData(indicadorVigencia?.prazoImplantacao)}</dd>
                  </div>
                </dl>
                {erros.indicadorVigencia && (
                  <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-status-bad">
                    <AlertCircle size={12} />
                    {erros.indicadorVigencia}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-muted">
                  Quem define estas datas é o <strong>indicador</strong>. Ajuste em Indicadores → editar.
                </p>
              </div>

              {/* Campos de produção (avulsa ou edição) */}
              {isProducao && (isEdit || modo === 'simples') && (
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

              {/* Total do pacote + linhas componentes */}
              {isProducao && !isEdit && modo === 'pacote' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      id="meta-mensal-total"
                      label="Meta mensal total (soma de referência)"
                      required
                      error={erros.metaMensal}
                      hint="Deve ser igual à soma das metas dos componentes abaixo"
                    >
                      <input
                        id="meta-mensal-total"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.metaMensal}
                        onChange={e => setField('metaMensal', e.target.value)}
                        className={inputCls(!!erros.metaMensal)}
                      />
                    </Field>
                    <Field
                      id="meta-anual-pacote"
                      label="Meta anual (opcional)"
                      error={erros.metaAnual}
                      hint="Se preenchida, a soma anual dos componentes deve conferir"
                    >
                      <input
                        id="meta-anual-pacote"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.metaAnual}
                        onChange={e => setField('metaAnual', e.target.value)}
                        className={inputCls(!!erros.metaAnual)}
                      />
                    </Field>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-text-secondary">Componentes (folhas)</p>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border-subtle p-2">
                      {componentes.map((c, i) => (
                        <div
                          key={i}
                          className="space-y-2 border-b border-border-subtle/60 pb-2 last:border-0"
                        >
                          <div>
                            <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-nome-${i}`}>
                              Nome do componente <span className="text-status-bad">*</span>
                            </label>
                            <input
                              id={`c-nome-${i}`}
                              type="text"
                              value={c.nome}
                              onChange={e => setComponente(i, 'nome', e.target.value)}
                              placeholder="Ex.: SADT eletivo"
                              maxLength={500}
                              className={inputCls(false)}
                            />
                          </div>
                          <div className="grid grid-cols-[1fr_1fr_80px_36px] items-end gap-2">
                          <div>
                            <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-mes-${i}`}>
                              Meta mensal
                            </label>
                            <input
                              id={`c-mes-${i}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.metaMensal}
                              onChange={e => setComponente(i, 'metaMensal', e.target.value)}
                              className={inputCls(false)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-anu-${i}`}>
                              Anual (opcional)
                            </label>
                            <input
                              id={`c-anu-${i}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.metaAnual}
                              onChange={e => setComponente(i, 'metaAnual', e.target.value)}
                              className={inputCls(false)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-p-${i}`}>
                              Peso
                            </label>
                            <input
                              id={`c-p-${i}`}
                              type="number"
                              min="0"
                              step="0.1"
                              value={c.peso}
                              onChange={e => setComponente(i, 'peso', e.target.value)}
                              className={inputCls(false)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeComponente(i)}
                            disabled={componentes.length <= 1}
                            className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-lg text-text-faint hover:bg-status-bad-bg hover:text-status-bad disabled:opacity-30"
                            aria-label="Remover linha"
                          >
                            <Trash2 size={16} />
                          </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-minp-${i}`}>
                                Mín. % (ref. mensal)
                              </label>
                              <input
                                id={`c-minp-${i}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={c.metaMinima}
                                onChange={e => setComponente(i, 'metaMinima', e.target.value)}
                                placeholder="opcional"
                                className={inputCls(false)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-parp-${i}`}>
                                Parc. % (ref. mensal)
                              </label>
                              <input
                                id={`c-parp-${i}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={c.metaParcial}
                                onChange={e => setComponente(i, 'metaParcial', e.target.value)}
                                placeholder="opcional"
                                className={inputCls(false)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-text-muted" htmlFor={`c-obs-${i}`}>
                              Observações (opcional)
                            </label>
                            <input
                              id={`c-obs-${i}`}
                              type="text"
                              value={c.observacoes}
                              onChange={e => setComponente(i, 'observacoes', e.target.value)}
                              placeholder="Contexto adicional"
                              className={inputCls(false)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addComponente}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <Plus size={16} />
                      Adicionar componente
                    </button>
                  </div>
                </>
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

              {/* Mínima + parcial: % do valor de referência (meta mensal ou meta de qualidade) */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="meta-minima"
                  error={erros.metaMinima}
                  label={
                    form.metaTipo === 'menor_igual'
                      ? 'Limite atingido (% da meta) — teto "atingido" em menor-é-melhor'
                      : 'Limite mínimo (% da meta) — abaixo disso: não atingido'
                  }
                  hint="Percentual 0–100 sobre o valor de referência informado acima (mensal/qualit.)."
                >
                  <input
                    id="meta-minima"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.metaMinima}
                    onChange={e => setField('metaMinima', e.target.value)}
                    placeholder="0–100"
                    className={inputCls(!!erros.metaMinima)}
                  />
                </Field>

                <Field
                  id="meta-parcial"
                  error={erros.metaParcial}
                  label={
                    form.metaTipo === 'menor_igual'
                      ? 'Limite parcial (% da meta) — entre parcial e "atingido"'
                      : 'Limite parcial (% da meta) — entre mínimo e "atingido"'
                  }
                  hint="Percentual 0–100 sobre a mesma referência. Deixe vazio se não usar faixa parcial."
                >
                  <input
                    id="meta-parcial"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.metaParcial}
                    onChange={e => setField('metaParcial', e.target.value)}
                    placeholder="0–100"
                    className={inputCls(!!erros.metaParcial)}
                  />
                </Field>
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
              {isEdit
                ? 'Salvar alterações'
                : isProducao && modo === 'pacote'
                  ? 'Criar pacote'
                  : 'Criar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
