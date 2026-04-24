// frontend/src/pages/EntradaMensal/EntradaMensalList.tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_LABELS, STATUS_BADGE, mockAcompanhamentos, unwrap } from './types'
import EntradaMensalModal from './EntradaMensalModal'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'

type Filtro = 'todos' | AcompanhamentoRecord['statusCumprimento']
type Coluna = 'nome' | 'meta' | 'realizado' | 'percentual' | 'fPonderado' | 'status'

function tituloCelula(a: AcompanhamentoRecord) {
  const n = a.nomeMeta?.trim() ?? ''
  if (a.somenteExibicao && a.papelMeta === 'agregada') {
    return n ? { prim: n, sub: 'Total (referência do pacote) — somente leitura' } : { prim: a.indicador.nome, sub: 'Total do pacote — somente leitura' }
  }
  if (!n) return a.indicador.nome
  if (a.papelMeta === 'componente' || n !== a.indicador.nome) {
    return { prim: a.indicador.nome, sub: n }
  }
  return a.indicador.nome
}

/** Ordem: agregada (só exibição) → componente → avulsa */
function rankNivel2e3(r: AcompanhamentoRecord): number {
  if (r.somenteExibicao) return 0
  if (r.papelMeta === 'componente') return 1
  return 2
}

function buildGruposIndicador(vis: AcompanhamentoRecord[]): { ordem: string[]; byId: Map<string, AcompanhamentoRecord[]> } {
  const ordem: string[] = []
  const seen = new Set<string>()
  for (const r of vis) {
    if (!seen.has(r.indicadorId)) {
      seen.add(r.indicadorId)
      ordem.push(r.indicadorId)
    }
  }
  const byId = new Map<string, AcompanhamentoRecord[]>()
  for (const id of ordem) {
    const rows = vis.filter((r) => r.indicadorId === id)
    rows.sort((a, b) => {
      const ra = rankNivel2e3(a) - rankNivel2e3(b)
      if (ra !== 0) return ra
      return `${a.nomeMeta ?? ''}`.localeCompare(`${b.nomeMeta ?? ''}`, 'pt', { sensitivity: 'base' })
    })
    byId.set(id, rows)
  }
  return { ordem, byId }
}

interface LinhaProps {
  a: AcompanhamentoRecord
  onAbrir: (a: AcompanhamentoRecord) => void
  /** Indentação do texto (componentes) */
  indent: boolean
}

function LinhaEntradaMensal({ a, onAbrir, indent }: LinhaProps) {
  const tit = tituloCelula(a)
  const perc = a.percentualCumprimento
  const percCls =
    a.statusCumprimento === 'atingido'     ? 'text-status-ok' :
    a.statusCumprimento === 'parcial'       ? 'text-status-warn' :
    a.statusCumprimento === 'pendente'      ? 'text-text-faint' : 'text-status-bad'
  const fGrupo = a.cumprimentoPonderadoNoGrupo
  const fText = fGrupo == null || Number.isNaN(fGrupo) ? '—' : `${(fGrupo * 100).toFixed(1)}%`

  const ro = a.somenteExibicao
    ? (a.realizadoSomaComponentes != null
      ? <span className="text-text-primary">{a.realizadoSomaComponentes}</span>
      : <span className="italic text-text-faint">—</span>)
    : a.valorRealizado !== null
      ? <span className="text-text-primary">{a.valorRealizado}</span>
      : <span className="italic text-text-faint">—</span>

  const exibirF = a.papelMeta === 'componente' || (a.somenteExibicao && a.papelMeta === 'agregada')
  const pctExibir = a.somenteExibicao ? '—' : (perc !== null ? `${perc.toFixed(1)}%` : '—')

  return (
    <div
      className="flex items-center px-4 gap-2 border-b border-border hover:bg-surface-alt"
    >
      <div className={`flex-[2.2] flex items-center gap-2 min-w-0 ${indent ? 'pl-5 border-l-2 border-l-primary/20' : ''}`}>
        <div className="min-w-0 flex-1">
          {typeof tit === 'string' ? (
            <span className="truncate text-sm text-text-primary">{tit}</span>
          ) : (
            <>
              <div className="truncate text-sm text-text-primary">{tit.prim}</div>
              <div className="truncate text-xs text-text-secondary">{tit.sub}</div>
            </>
          )}
        </div>
        {a.somenteExibicao && a.papelMeta === 'agregada' && (
          <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-surface border border-border text-text-secondary" title="Conferência: valor lançado nas sub-metas; evita dupla contagem">
            Total
          </span>
        )}
        {a.papelMeta === 'componente' && (
          <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary border border-primary/20" title="Sub-meta (componente)">Sub</span>
        )}
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
          {a.metaTipo === 'maior_igual' ? '↑' : '↓'}
        </span>
      </div>
      <div className="w-[70px] shrink-0">
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
          {a.indicador.tipo === 'producao' ? 'Prod.' : 'Qual.'}
        </span>
      </div>
      <div className="w-[90px] shrink-0 font-mono text-sm text-text-primary text-right">
        {a.metaVigenteMensal ?? a.metaVigenteQualit ?? '—'}
      </div>
      <div className="w-[90px] shrink-0 font-mono text-sm text-right">
        {ro}
      </div>
      <div className={`w-[64px] shrink-0 font-mono font-bold text-sm text-right ${a.somenteExibicao ? 'text-text-faint' : percCls}`}>
        {pctExibir}
      </div>
      <div
        className="w-[56px] shrink-0 font-mono text-xs text-right text-text-secondary"
        title="F = média ponderada dos fatores (pesos wᵢ); não é soma(realiz)/soma(metas)"
      >
        {exibirF ? fText : '—'}
      </div>
      <div className="w-[80px] shrink-0">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[a.statusCumprimento]}`}>
          {a.somenteExibicao ? '—' : STATUS_LABELS[a.statusCumprimento]}
        </span>
      </div>
      <div className="w-[72px] shrink-0 flex justify-end">
        {a.somenteExibicao ? (
          <span className="text-[10px] text-text-faint" title="Lançamento somente em metas folha">—</span>
        ) : (
          <button
            type="button"
            onClick={() => onAbrir(a)}
            className={[
              'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
              a.id === null
                ? 'border border-border text-text-secondary hover:border-primary hover:text-primary'
                : 'bg-primary text-white hover:bg-primary/90',
            ].join(' ')}
          >
            {a.id === null ? 'Lançar' : 'Editar'}
          </button>
        )}
      </div>
    </div>
  )
}

function CabecalhoIndicador({ nome, tipoProducao }: { nome: string; tipoProducao: 'producao' | 'qualidade' }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-border">
      <h3 className="text-sm font-semibold text-text-primary truncate min-w-0 flex-1">{nome}</h3>
      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-md bg-surface-alt border border-border text-text-secondary">
        {tipoProducao === 'producao' ? 'Produção' : 'Qualidade'}
      </span>
    </div>
  )
}

export default function EntradaMensalList() {
  const { unidadeId } = useParams<{ unidadeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const api = useApi()
  const { token: authToken } = useAuth()

  const mes = searchParams.get('mes') ?? (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  const [itens, setItens] = useState<AcompanhamentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [nomeUnidade, setNomeUnidade] = useState('')
  const [modal, setModal] = useState<AcompanhamentoRecord | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [coluna, setColuna] = useState<Coluna>('nome')
  const [asc, setAsc] = useState(true)

  const mesInput = mes.slice(0, 7)

  const carregar = useCallback(async (signal: { aborted: boolean }) => {
    setLoading(true)
    try {
      const raw = await api.get(`/acompanhamentos?unidadeId=${unidadeId}&mesReferencia=${mes}`)
      if (!signal.aborted) setItens(unwrap(raw) as AcompanhamentoRecord[])
    } catch {
      if (!signal.aborted) setItens(mockAcompanhamentos)
    } finally {
      if (!signal.aborted) setLoading(false)
    }

    try {
      const raw = await api.get(`/unidades/${unidadeId}`)
      if (!signal.aborted) {
        const u = unwrap(raw) as { nome: string }
        setNomeUnidade(u.nome)
      }
    } catch { /* ignora */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeId, mes, authToken])

  useEffect(() => {
    const signal = { aborted: false }
    carregar(signal)
    return () => { signal.aborted = true }
  }, [carregar])

  function handleMesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [a, m] = e.target.value.split('-')
    if (a && m) setSearchParams({ mes: `${a}-${m}-01` })
  }

  function toggleSort(c: Coluna) {
    if (coluna === c) setAsc(v => !v)
    else { setColuna(c); setAsc(true) }
  }

  const filtrados = useMemo(() => {
    return itens.filter((a) => {
      if (a.somenteExibicao) {
        if (a.papelMeta !== 'agregada') return false
        return itens.some(
          (c) => !c.somenteExibicao
            && c.papelMeta === 'componente'
            && c.parentMetaId === a.metaId
            && c.indicadorId === a.indicadorId
            && (filtro === 'todos' || c.statusCumprimento === filtro),
        )
      }
      return filtro === 'todos' || a.statusCumprimento === filtro
    })
  }, [itens, filtro])

  const filtradosOrdenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      let va: string | number = 0; let vb: string | number = 0
      if (coluna === 'nome') {
        va = `${a.indicador.nome}\t${a.nomeMeta ?? ''}`; vb = `${b.indicador.nome}\t${b.nomeMeta ?? ''}`
      }
      if (coluna === 'meta')       { va = a.metaVigenteMensal ?? 0;      vb = b.metaVigenteMensal ?? 0 }
      if (coluna === 'realizado')  {
        const ra = a.somenteExibicao ? a.realizadoSomaComponentes : a.valorRealizado
        const rb = b.somenteExibicao ? b.realizadoSomaComponentes : b.valorRealizado
        va = ra ?? -1; vb = rb ?? -1
      }
      if (coluna === 'percentual') { va = a.percentualCumprimento ?? -1; vb = b.percentualCumprimento ?? -1 }
      if (coluna === 'fPonderado') {
        va = a.cumprimentoPonderadoNoGrupo ?? -1; vb = b.cumprimentoPonderadoNoGrupo ?? -1
      }
      if (coluna === 'status')     { va = a.statusCumprimento;           vb = b.statusCumprimento }
      if (va < vb) return asc ? -1 : 1
      if (va > vb) return asc ?  1 : -1
      return 0
    })
  }, [filtrados, coluna, asc])

  const { ordem, byId } = useMemo(() => buildGruposIndicador(filtradosOrdenados), [filtradosOrdenados])

  const folhasApenas = useMemo(() => itens.filter(i => !i.somenteExibicao), [itens])
  const stats = {
    total:     folhasApenas.length,
    atingidos: folhasApenas.filter(a => a.statusCumprimento === 'atingido').length,
    parciais:  folhasApenas.filter(a => a.statusCumprimento === 'parcial').length,
    pendentes: folhasApenas.filter(a => a.statusCumprimento === 'pendente').length,
  }

  function handleSalvo() {
    setModal(null)
    const signal = { aborted: false }
    void carregar(signal)
  }

  const SortBtn = ({ c, label }: { c: Coluna; label: string }) => (
    <button type="button" onClick={() => toggleSort(c)} className="flex items-center gap-0.5 hover:text-primary transition-colors">
      {label}{coluna === c ? (asc ? ' ↑' : ' ↓') : ''}
    </button>
  )

  const nenhumaLinha = filtradosOrdenados.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/entrada-mensal')}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary">{nomeUnidade || 'Entrada Mensal'}</h1>
          <p className="text-xs text-text-secondary mt-0.5 max-w-2xl">
            Por <strong>indicador</strong>: <strong>Total</strong> (meta agregada) mostra referência, soma dos realizados e F — leitura;
            o valor é lançado em cada <strong>sub-meta (componente)</strong> ou em meta <strong>avulsa</strong>.
            Assim evita dupla contagem e segue a rastreabilidade por linha.
          </p>
        </div>
        <input
          type="month"
          value={mesInput}
          onChange={handleMesChange}
          className="rounded-xl border border-border px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Metas (folhas)', value: stats.total,     cls: 'text-text-primary' },
          { label: 'Atingidos',        value: stats.atingidos,  cls: 'text-status-ok' },
          { label: 'Parciais',         value: stats.parciais,   cls: 'text-status-warn' },
          { label: 'Pendentes',        value: stats.pendentes,  cls: 'text-text-secondary' },
        ] as const).map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-text-secondary">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['todos', 'atingido', 'parcial', 'nao_atingido', 'pendente'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
              filtro === f
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text-secondary hover:border-primary',
            ].join(' ')}
          >
            {f === 'todos' ? 'Todos' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : nenhumaLinha ? (
        <p className="py-12 text-center text-sm text-text-secondary">Não há metas a exibir para esta unidade e filtro (verifique metas e vigência do indicador).</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 720 }}>
              <div className="flex items-center px-4 py-2.5 bg-surface-alt border-b border-border text-xs font-medium text-text-secondary gap-2">
                <div className="flex-[2.2]"><SortBtn c="nome" label="Indicador / meta" /></div>
                <div className="w-[70px] shrink-0">Tipo</div>
                <div className="w-[90px] shrink-0 text-right"><SortBtn c="meta" label="Ref." /></div>
                <div className="w-[90px] shrink-0 text-right"><SortBtn c="realizado" label="Realizado" /></div>
                <div className="w-[64px] shrink-0 text-right"><SortBtn c="percentual" label="% linha" /></div>
                <div className="w-[56px] shrink-0 text-right" title="F: média ponderada no pacote (não razão simples)">
                  <SortBtn c="fPonderado" label="F" />
                </div>
                <div className="w-[80px] shrink-0"><SortBtn c="status" label="Status" /></div>
                <div className="w-[72px] shrink-0" />
              </div>
              <div className="max-h-[min(60vh,720px)] overflow-y-auto">
                {ordem.map((indicadorId) => {
                  const rows = byId.get(indicadorId) ?? []
                  if (rows.length === 0) return null
                  const h = rows[0]
                  return (
                    <div key={indicadorId} className="border-b border-border last:border-b-0">
                      <CabecalhoIndicador nome={h.indicador.nome} tipoProducao={h.indicador.tipo} />
                      {rows.map((a) => (
                        <LinhaEntradaMensal
                          key={a.somenteExibicao ? `agg-${a.metaId}` : `${a.indicadorId}-${a.metaId}-${a.id ?? 'novo'}`}
                          a={a}
                          onAbrir={setModal}
                          indent={!a.somenteExibicao && a.papelMeta === 'componente'}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <EntradaMensalModal
          key={`${modal.indicadorId}-${modal.metaId}-${modal.id ?? 'novo'}`}
          acompanhamento={modal}
          onSalvo={handleSalvo}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  )
}
