import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, Search } from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import type { Grade, ProfissionalBusca, SetorResumo } from './types'
import { unwrap, AREA_LABEL, fmtH } from './types'
import GradeMes from './GradeMes'
import DiaADia from './DiaADia'
import ContratoApresentado from './ContratoApresentado'

const ABAS = [
  { v: 'setor', label: 'Por setor' },
  { v: 'profissional', label: 'Por profissional' },
  { v: 'contrato', label: 'Contrato × Apresentado' },
] as const

const selectCls = 'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary'

const mesAnterior = () => {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Erro({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <div className="flex items-center gap-2 rounded-xl border border-status-bad-border bg-status-bad-bg px-4 py-3 text-sm text-status-bad"><AlertCircle size={16} />{msg}</div>
}

export default function EscalasPage() {
  const { get } = useApi()
  const [params, setParams] = useSearchParams()
  const aba = ABAS.find(a => a.v === params.get('aba'))?.v ?? 'setor'
  const mes = params.get('mes') ?? mesAnterior()
  const unidadeId = params.get('unidade') ?? ''
  const setorId = params.get('setor') ?? ''
  const profissionalId = params.get('prof') ?? ''
  const vista = params.get('vista') === 'prof' ? 'prof' : 'dia'
  const secaoSetor = useRef<HTMLDivElement>(null)
  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    setParams(p, { replace: true })
  }

  const [unidades, setUnidades] = useState<{ id: string; label: string }[]>([])
  const [setores, setSetores] = useState<SetorResumo[]>([])
  const [grade, setGrade] = useState<Grade | null>(null)
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<ProfissionalBusca[]>([])
  const [profNome, setProfNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    get('/unidades?ativo=1')
      .then(r => setUnidades((unwrap<{ id: string; nome: string; sigla?: string }[]>(r as never) ?? [])
        .map(u => ({ id: u.id, label: u.sigla ? `${u.sigla} — ${u.nome}` : u.nome }))))
      .catch(() => setUnidades([]))
  }, [get])

  // Setores do mês (também alimenta o cadastro de postos)
  useEffect(() => {
    if (!unidadeId) { setSetores([]); return }
    setErro(null)
    get(`/escalas/setores?unidade_id=${unidadeId}&mes=${mes}-01`)
      .then(r => setSetores(unwrap<SetorResumo[]>(r as never)))
      .catch(e => { setSetores([]); setErro(e instanceof ApiError ? e.message : 'Erro ao carregar setores.') })
  }, [get, unidadeId, mes])

  const carregarGrade = useCallback(async () => {
    const q = aba === 'setor'
      ? (unidadeId && setorId ? `unidade_id=${unidadeId}&setor_id=${setorId}` : null)
      : aba === 'profissional' && profissionalId ? `profissional_id=${profissionalId}` : null
    if (!q) { setGrade(null); return }
    setLoading(true); setErro(null)
    try {
      setGrade(unwrap<Grade>(await get(`/escalas/grade?mes=${mes}-01&${q}`) as never))
    } catch (e) {
      setGrade(null); setErro(e instanceof ApiError ? e.message : 'Erro ao carregar a escala.')
    } finally { setLoading(false) }
  }, [get, aba, mes, unidadeId, setorId, profissionalId])

  useEffect(() => { carregarGrade() }, [carregarGrade])

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busca.trim().length < 3) return
    try {
      setAchados(unwrap<ProfissionalBusca[]>(await get(`/escalas/profissionais?busca=${encodeURIComponent(busca.trim())}`) as never))
    } catch (err) { setErro(err instanceof ApiError ? err.message : 'Erro na busca.') }
  }

  const setor = setores.find(s => s.setorId === setorId)
  const temSecao = aba === 'setor' && !!setor && !!grade
  useEffect(() => {
    if (temSecao) secaoSetor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [temSecao, setorId])
  const nomeProf = profNome || grade?.plantoes.find(p => p.profissional)?.profissional || ''
  const precisaUnidade = aba !== 'profissional'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Escalas</h1>
        <p className="text-sm text-text-muted">
          Escalas apresentadas nas prestações de contas: previsto (escalado) × realizado (normal, cobertura, troca, extra), vazios destacados.
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-border-subtle" role="tablist">
        {ABAS.map(a => (
          <button key={a.v} type="button" role="tab" aria-selected={aba === a.v} onClick={() => setParam({ aba: a.v })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${aba === a.v ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            {a.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Mês</span>
          <input type="month" value={mes} onChange={e => e.target.value && setParam({ mes: e.target.value })} className={selectCls} />
        </label>
        {precisaUnidade && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Unidade</span>
            <select value={unidadeId} onChange={e => setParam({ unidade: e.target.value, setor: null })} className={selectCls}>
              <option value="">Selecione…</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
        )}
        {aba === 'profissional' && (
          <form onSubmit={buscar} className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-muted">Nome ou registro (CRM, COREN…)</span>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="mín. 3 caracteres" className={`${selectCls} w-72`} />
            </label>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
              <Search size={15} />Buscar
            </button>
          </form>
        )}
        {loading && <Loader2 size={18} className="mb-2 animate-spin text-primary" />}
      </div>

      <Erro msg={erro} />

      {precisaUnidade && !unidadeId && (
        <div className="py-16 text-center text-sm text-text-muted">Selecione a unidade.</div>
      )}

      {aba === 'setor' && unidadeId && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-sm">
            <table className="w-full text-sm" style={{ minWidth: 820 }}>
              <thead className="bg-primary/5 text-text-secondary">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Setor</th>
                  <th className="px-4 py-2 text-left font-medium">Área</th>
                  <th className="px-4 py-2 text-right font-medium">Profissionais</th>
                  <th className="px-4 py-2 text-right font-medium">Previsto (pl · h)</th>
                  <th className="px-4 py-2 text-right font-medium">Realizado (pl · h)</th>
                  <th className="px-4 py-2 text-right font-medium">Não realizado</th>
                  <th className="px-4 py-2 text-right font-medium">Postos vagos</th>
                  <th className="px-4 py-2 text-right font-medium">Dias sem escala</th>
                </tr>
              </thead>
              <tbody>
                {setores.map(s => {
                  const semEscala = s.previsto.plantoes === 0
                  return (
                    <tr key={s.setorId} onClick={() => setParam({ setor: s.setorId })}
                      className={`cursor-pointer border-t border-border-subtle hover:bg-hover ${s.setorId === setorId ? 'bg-primary/10' : ''} ${semEscala ? 'text-text-faint' : ''}`}>
                      <td className="px-4 py-2 font-medium">{s.nome}{semEscala && <span className="ml-2 rounded-full bg-status-bad-bg px-1.5 py-0.5 text-[10px] text-status-bad">sem escala no mês</span>}</td>
                      <td className="px-4 py-2">{AREA_LABEL[s.area]}</td>
                      <td className="px-4 py-2 text-right font-mono">{s.profissionais}</td>
                      <td className="px-4 py-2 text-right font-mono">{s.previsto.plantoes} · {fmtH(s.previsto.horas)}</td>
                      <td className="px-4 py-2 text-right font-mono">{s.realizado.plantoes} · {fmtH(s.realizado.horas)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${s.naoRealizado ? 'text-status-warn' : ''}`}>{s.naoRealizado}</td>
                      <td className={`px-4 py-2 text-right font-mono ${s.vagos ? 'font-bold text-status-bad' : ''}`}>{s.vagos}</td>
                      <td className={`px-4 py-2 text-right font-mono ${s.diasSemPlantao && !semEscala ? 'font-bold text-status-bad' : ''}`}>{s.diasSemPlantao}</td>
                    </tr>
                  )
                })}
                {setores.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-text-muted">Nenhum setor de escala nesta unidade.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {setor && grade && (
            <div ref={secaoSetor} className="flex scroll-mt-4 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{setor.nome}</h2>
                <div className="ml-auto flex overflow-hidden rounded-lg border border-border-subtle" role="group" aria-label="Vista">
                  {([['dia', 'Dia a dia'], ['prof', 'Por profissional']] as const).map(([v, label]) => (
                    <button key={v} type="button" aria-pressed={vista === v} onClick={() => setParam({ vista: v === 'dia' ? null : v })}
                      className={`px-3 py-1.5 text-xs font-medium ${vista === v ? 'bg-primary text-white' : 'text-text-secondary hover:bg-hover'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {vista === 'dia'
                ? <DiaADia grade={grade} />
                : <GradeMes grade={grade} linhaPor="profissional" nomeArquivo={`escala-${setor.nome}-${mes}.tsv`} />}
            </div>
          )}
        </div>
      )}

      {aba === 'profissional' && (
        <div className="flex flex-col gap-4">
          {achados.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {achados.map(a => (
                <button key={a.profissionalId} type="button"
                  onClick={() => { setProfNome(a.nome); setParam({ prof: a.profissionalId }) }}
                  className={`rounded-lg border px-3 py-1.5 text-left text-xs ${a.profissionalId === profissionalId ? 'border-primary bg-primary/10 text-primary' : 'border-border-subtle hover:bg-hover'}`}>
                  <div className="font-medium">{a.nome}</div>
                  <div className="text-text-faint">{a.conselho === 'SEM_REGISTRO' ? 'sem registro' : `${a.conselho} ${a.registroNumero}${a.registroUf ? `/${a.registroUf}` : ''}`}</div>
                </button>
              ))}
            </div>
          )}
          {profissionalId && grade && (
            <>
              {nomeProf && <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{nomeProf}</h2>}
              <GradeMes grade={grade} linhaPor="setor" nomeArquivo={`escala-${nomeProf || profissionalId}-${mes}.tsv`} />
            </>
          )}
          {!profissionalId && <div className="py-16 text-center text-sm text-text-muted">Busque um profissional.</div>}
        </div>
      )}

      {aba === 'contrato' && unidadeId && <ContratoApresentado unidadeId={unidadeId} mes={mes} setores={setores} />}
    </div>
  )
}
