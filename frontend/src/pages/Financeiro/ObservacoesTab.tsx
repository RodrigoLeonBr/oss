import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Flag, Loader2, MessageSquareText, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import { Barra, Erro, classeLbl, classeSel } from './Filtros'
import { CONTAS, CONTA_LABEL, fmtMes, unwrap, type Conta, type Observacao, type OpcaoEscopo } from './types'

export const SECOES = [
  { v: 'metas', label: 'Cumprimento das metas' },
  { v: 'cronograma', label: 'Cronograma de desembolso' },
  { v: 'saldos', label: 'Saldos em contas' },
  { v: 'despesas', label: 'Despesas mensais' },
  { v: 'evolucao', label: 'Evolução das contas' },
  { v: 'repasses', label: 'Anexo: repasses' },
  { v: 'transferencias', label: 'Anexo: transferências entre contas' },
  { v: 'recursos_proprios', label: 'Anexo: recursos próprios' },
  { v: 'rendimentos', label: 'Anexo: rendimentos' },
  { v: 'despesas_anexo', label: 'Anexo: despesas' },
  { v: 'saldos_anexo', label: 'Anexo: saldos' },
  { v: 'conclusao', label: 'Conclusão / parecer' },
]
const TIPOS = { nota: 'Nota do mês', secao: 'Texto de seção', pendencia: 'Pendência com a OSS' } as const

interface Form {
  obs_id?: string; tipo: keyof typeof TIPOS; unidade_id: string; conta: '' | Conta; mes: string
  periodo_ini: string; periodo_fim: string; secao: string; texto: string
}
const vazio = (tipo: Form['tipo'] = 'nota'): Form => ({ tipo, unidade_id: '', conta: '', mes: '', periodo_ini: '', periodo_fim: '', secao: 'saldos', texto: '' })

// Fora do componente pai (não perde foco).
function Editor({ form, set, unidades, onSalvar, onCancelar, salvando }: {
  form: Form; set: (p: Partial<Form>) => void; unidades: OpcaoEscopo[]
  onSalvar: () => void; onCancelar: () => void; salvando: boolean
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className={classeLbl}>Tipo
          <select className={classeSel} value={form.tipo} disabled={!!form.obs_id} onChange={e => set({ tipo: e.target.value as Form['tipo'] })}>
            {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {form.tipo === 'secao' ? (
          <>
            <label className={classeLbl}>Seção
              <select className={classeSel} value={form.secao} onChange={e => set({ secao: e.target.value })}>
                {SECOES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </label>
            <label className={classeLbl}>Período de
              <input type="month" className={classeSel} value={form.periodo_ini} onChange={e => set({ periodo_ini: e.target.value })} />
            </label>
            <label className={classeLbl}>até
              <input type="month" className={classeSel} value={form.periodo_fim} onChange={e => set({ periodo_fim: e.target.value })} />
            </label>
          </>
        ) : (
          <>
            <label className={classeLbl}>Unidade
              <select className={classeSel} value={form.unidade_id} onChange={e => set({ unidade_id: e.target.value })}>
                <option value="">Contrato todo</option>
                {unidades.map(u => <option key={u.unidade_id} value={u.unidade_id}>{u.sigla}</option>)}
              </select>
            </label>
            <label className={classeLbl}>Conta
              <select className={classeSel} value={form.conta} onChange={e => set({ conta: e.target.value as Form['conta'] })}>
                <option value="">—</option>
                {CONTAS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </label>
            <label className={classeLbl}>Mês
              <input type="month" className={classeSel} value={form.mes} onChange={e => set({ mes: e.target.value })} />
            </label>
          </>
        )}
      </div>
      <textarea aria-label="Texto" rows={form.tipo === 'secao' ? 8 : 3} className={`${classeSel} w-full`} value={form.texto}
        placeholder={form.tipo === 'secao' ? 'Texto analítico que entra nesta seção do relatório do período…' : 'Observação…'}
        onChange={e => set({ texto: e.target.value })} />
      <div className="flex gap-2">
        <button type="button" disabled={salvando || !form.texto.trim()} onClick={onSalvar}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
        <button type="button" onClick={onCancelar} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-hover">Cancelar</button>
      </div>
    </section>
  )
}

export default function ObservacoesTab({ opcoes }: { opcoes: OpcaoEscopo[] }) {
  const { get, post, put, del } = useApi()
  const perm = usePermission('financeiro')
  const contratos = useMemo(() => [...new Map(opcoes.map(o => [o.contrato_id, o.numero])).entries()], [opcoes])
  const [contratoId, setContratoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [status, setStatus] = useState('')
  const [lista, setLista] = useState<Observacao[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (!contratoId && contratos.length) setContratoId(contratos[0][0]) }, [contratos, contratoId])

  const carregar = useCallback(async () => {
    if (!contratoId) return
    setLoading(true); setErro(null)
    const q = new URLSearchParams({ contrato_id: contratoId, ...(tipo ? { tipo } : {}), ...(status ? { status } : {}) })
    try { setLista(unwrap<Observacao[]>(await get(`/financeiro/observacoes?${q}`))) } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao listar.')
    } finally { setLoading(false) }
  }, [get, contratoId, tipo, status])
  useEffect(() => { carregar() }, [carregar])

  const ym = (s: string | null) => (s ? s.slice(0, 7) : '')
  const d1 = (s: string) => (s ? `${s}-01` : null)
  const salvar = async () => {
    if (!form) return
    setLoading(true); setErro(null)
    const corpo = form.tipo === 'secao'
      ? { secao: form.secao, periodo_ini: d1(form.periodo_ini), periodo_fim: d1(form.periodo_fim), texto: form.texto }
      : { unidade_id: form.unidade_id || null, conta: form.conta || null, mes_referencia: d1(form.mes), texto: form.texto }
    try {
      if (form.obs_id) await put(`/financeiro/observacoes/${form.obs_id}`, corpo)
      else await post('/financeiro/observacoes', { contrato_id: contratoId, tipo: form.tipo, ...corpo })
      setForm(null); await carregar()
    } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro ao salvar.') } finally { setLoading(false) }
  }
  const alternarStatus = async (o: Observacao) => {
    try { await put(`/financeiro/observacoes/${o.obs_id}`, { status: o.status === 'aberta' ? 'resolvida' : 'aberta' }); await carregar() } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao atualizar.')
    }
  }
  const remover = async (o: Observacao) => {
    if (!window.confirm('Remover esta observação?')) return
    try { await del(`/financeiro/observacoes/${o.obs_id}`); await carregar() } catch (e) { setErro(e instanceof ApiError ? e.message : 'Erro ao remover.') }
  }
  const editar = (o: Observacao) => setForm({
    obs_id: o.obs_id, tipo: o.tipo, unidade_id: o.unidade_id ?? '', conta: o.conta ?? '', mes: ym(o.mes_referencia),
    periodo_ini: ym(o.periodo_ini), periodo_fim: ym(o.periodo_fim), secao: o.secao ?? 'saldos', texto: o.texto,
  })

  return (
    <div className="flex flex-col gap-4">
      <Barra>
        <label className={classeLbl}>Contrato
          <select className={classeSel} value={contratoId} onChange={e => setContratoId(e.target.value)}>
            {contratos.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label className={classeLbl}>Tipo
          <select className={classeSel} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={classeLbl}>Situação
          <select className={classeSel} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Todas</option><option value="aberta">Abertas</option><option value="resolvida">Resolvidas</option>
          </select>
        </label>
        {perm.canInsert && !form && (
          <button type="button" onClick={() => setForm(vazio(tipo === 'secao' || tipo === 'pendencia' ? tipo : 'nota'))}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
            <Plus size={16} />Nova
          </button>
        )}
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </Barra>
      <Erro msg={erro} />
      {form && (
        <Editor form={form} set={p => setForm(f => (f ? { ...f, ...p } : f))} salvando={loading}
          unidades={opcoes.filter(o => o.contrato_id === contratoId)} onSalvar={salvar} onCancelar={() => setForm(null)} />
      )}
      <ul className="flex flex-col gap-2">
        {lista.map(o => {
          const Icone = o.tipo === 'pendencia' ? Flag : MessageSquareText
          const ref = o.tipo === 'secao'
            ? `${SECOES.find(s => s.v === o.secao)?.label ?? o.secao} · ${o.periodo_ini ? fmtMes(o.periodo_ini) : ''}–${o.periodo_fim ? fmtMes(o.periodo_fim) : ''}`
            : [o.sigla, o.conta && CONTA_LABEL[o.conta], o.mes_referencia && fmtMes(o.mes_referencia)].filter(Boolean).join(' · ') || 'Contrato todo'
          return (
            <li key={o.obs_id} className="flex gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 shadow-sm">
              <Icone size={16} className={`mt-0.5 shrink-0 ${o.tipo === 'pendencia' && o.status === 'aberta' ? 'text-status-warn' : 'text-text-faint'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-x-2 text-xs text-text-muted">
                  <span className="font-semibold uppercase">{TIPOS[o.tipo]}</span><span>{ref}</span>
                  {o.status && <span className={o.status === 'aberta' ? 'text-status-warn' : 'text-status-ok'}>{o.status}</span>}
                  {o.origem === 'historico' && <span title={o.fonte ?? ''}>histórico</span>}
                </div>
                <p className="whitespace-pre-line text-sm text-text-primary">{o.texto}</p>
              </div>
              <div className="flex shrink-0 items-start gap-1">
                {o.tipo === 'pendencia' && perm.canUpdate && (
                  <button type="button" title={o.status === 'aberta' ? 'Marcar resolvida' : 'Reabrir'} onClick={() => alternarStatus(o)} className="rounded p-1 text-text-faint hover:bg-hover">
                    {o.status === 'aberta' ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
                  </button>
                )}
                {perm.canUpdate && <button type="button" title="Editar" onClick={() => editar(o)} className="rounded p-1 text-text-faint hover:bg-hover"><Pencil size={16} /></button>}
                {perm.canDelete && <button type="button" title="Remover" onClick={() => remover(o)} className="rounded p-1 text-text-faint hover:bg-hover hover:text-status-bad"><Trash2 size={16} /></button>}
              </div>
            </li>
          )
        })}
        {!lista.length && !loading && <li className="py-10 text-center text-sm text-text-muted">Nenhuma observação.</li>}
      </ul>
    </div>
  )
}
