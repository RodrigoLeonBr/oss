import { useEffect, useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import type { Dimensionamento, SetorResumo } from './types'
import { CATEGORIAS, DIAS_SEMANA } from './types'

interface Props {
  unidadeId: string
  setores: SetorResumo[]
  registro?: Dimensionamento
  onSalvo: () => void
  onFechar: () => void
}

type Form = Omit<Dimensionamento, 'dimensionamentoId' | 'setor' | 'unidadeId'>

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'

// Fora do modal para não perder foco a cada render (code-style).
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  )
}

export default function DimensionamentoFormModal({ unidadeId, setores, registro, onSalvo, onFechar }: Props) {
  const { post, put } = useApi()
  const [form, setForm] = useState<Form>(() => ({
    setorId: registro?.setorId ?? '',
    categoria: registro?.categoria ?? '',
    turnoInicio: registro?.turnoInicio ?? '07:00',
    turnoFim: registro?.turnoFim ?? '19:00',
    qtdPostos: registro?.qtdPostos ?? 1,
    diasSemana: registro?.diasSemana ?? '1234567',
    vigenciaInicio: registro?.vigenciaInicio ?? '',
    vigenciaFim: registro?.vigenciaFim ?? '',
    fonte: registro?.fonte ?? '',
    obs: registro?.obs ?? '',
  }))
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onFechar])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm(f => ({ ...f, [k]: v })); setErro('') }
  const toggleDia = (d: string) => {
    const s = new Set(form.diasSemana.split(''))
    if (s.has(d)) s.delete(d); else s.add(d)
    set('diasSemana', [...s].sort().join(''))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.setorId) { setErro('Escolha o setor.'); return }
    if (!form.vigenciaInicio) { setErro('Informe o início da vigência.'); return }
    if (!form.diasSemana) { setErro('Marque ao menos um dia da semana.'); return }
    setLoading(true)
    try {
      const body = { ...form, unidadeId, vigenciaFim: form.vigenciaFim || null }
      if (registro) await put(`/escalas/dimensionamento/${registro.dimensionamentoId}`, body)
      else await post('/escalas/dimensionamento', body)
      onSalvo()
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao salvar')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="dim-titulo">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 id="dim-titulo" className="text-base font-semibold text-text-primary">{registro ? 'Editar postos' : 'Novos postos do contrato'}</h2>
            <p className="text-xs text-text-muted">Postos exigidos por turno no setor (ex.: 1 pediatra 07–19 todos os dias)</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-text-faint hover:bg-hover"><X size={20} /></button>
        </div>
        <form onSubmit={salvar} noValidate className="space-y-4 px-6 py-5">
          {erro && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-status-bad-border bg-status-bad-bg px-3 py-2 text-sm text-status-bad">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{erro}</span>
            </div>
          )}
          <Field id="dim-setor" label="Setor da escala">
            <select id="dim-setor" value={form.setorId} onChange={e => set('setorId', e.target.value)} className={inputCls}>
              <option value="">Selecione…</option>
              {setores.map(s => <option key={s.setorId} value={s.setorId}>{s.nome}</option>)}
            </select>
          </Field>
          <Field id="dim-cat" label="Categoria profissional">
            <select id="dim-cat" value={form.categoria ?? ''} onChange={e => set('categoria', e.target.value)} className={inputCls}>
              {CATEGORIAS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field id="dim-ini" label="Início do turno">
              <input id="dim-ini" type="time" value={form.turnoInicio} onChange={e => set('turnoInicio', e.target.value)} className={inputCls} />
            </Field>
            <Field id="dim-fim" label="Fim do turno">
              <input id="dim-fim" type="time" value={form.turnoFim} onChange={e => set('turnoFim', e.target.value)} className={inputCls} />
            </Field>
            <Field id="dim-qtd" label="Postos">
              <input id="dim-qtd" type="number" min={1} value={form.qtdPostos} onChange={e => set('qtdPostos', Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-text-secondary">Dias da semana</legend>
            <div className="flex gap-1">
              {DIAS_SEMANA.map((l, i) => {
                const d = String(i + 1)
                const on = form.diasSemana.includes(d)
                return (
                  <button key={d} type="button" onClick={() => toggleDia(d)} aria-pressed={on}
                    className={`h-9 w-9 rounded-lg border text-sm font-medium ${on ? 'border-primary bg-primary text-white' : 'border-border-subtle text-text-secondary hover:bg-hover'}`}>
                    {l}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field id="dim-vi" label="Vigência — início">
              <input id="dim-vi" type="date" value={form.vigenciaInicio} onChange={e => set('vigenciaInicio', e.target.value)} className={inputCls} />
            </Field>
            <Field id="dim-vf" label="Vigência — fim (opcional)">
              <input id="dim-vf" type="date" value={form.vigenciaFim ?? ''} onChange={e => set('vigenciaFim', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field id="dim-fonte" label="Fonte (cláusula / anexo do plano de trabalho)">
            <input id="dim-fonte" value={form.fonte ?? ''} maxLength={300} onChange={e => set('fonte', e.target.value)} className={inputCls} />
          </Field>
          <Field id="dim-obs" label="Observação">
            <textarea id="dim-obs" rows={2} value={form.obs ?? ''} onChange={e => set('obs', e.target.value)} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onFechar} className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-hover">Cancelar</button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
