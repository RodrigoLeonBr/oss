// frontend/src/pages/EntradaMensal/EntradaMensalList.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { List, type RowComponentProps } from 'react-window'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { AcompanhamentoRecord } from './types'
import { STATUS_LABELS, STATUS_BADGE, mockAcompanhamentos, unwrap } from './types'
import EntradaMensalModal from './EntradaMensalModal'
import { useApi } from '../../hooks/useApi'

const ROW_HEIGHT = 52

type Filtro = 'todos' | AcompanhamentoRecord['statusCumprimento']
type Coluna = 'nome' | 'meta' | 'realizado' | 'percentual' | 'status'

interface RowData {
  itens: AcompanhamentoRecord[]
  onAbrir: (a: AcompanhamentoRecord) => void
}

function Row({ index, style, itens, onAbrir }: RowComponentProps<RowData>) {
  const a = itens[index]
  const perc = a.percentualCumprimento
  const percCls =
    a.statusCumprimento === 'atingido'     ? 'text-status-ok' :
    a.statusCumprimento === 'parcial'       ? 'text-status-warn' :
    a.statusCumprimento === 'pendente'      ? 'text-text-faint' : 'text-status-bad'

  return (
    <div style={style} className="flex items-center px-4 gap-2 border-b border-border hover:bg-surface-alt">
      <div className="flex-[2] flex items-center gap-2 min-w-0">
        <span className="truncate text-sm text-text-primary">{a.indicador.nome}</span>
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
        {a.valorRealizado !== null
          ? <span className="text-text-primary">{a.valorRealizado}</span>
          : <span className="italic text-text-faint">—</span>}
      </div>
      <div className={`w-[70px] shrink-0 font-mono font-bold text-sm text-right ${percCls}`}>
        {perc !== null ? `${perc.toFixed(1)}%` : '—'}
      </div>
      <div className="w-[80px] shrink-0">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[a.statusCumprimento]}`}>
          {STATUS_LABELS[a.statusCumprimento]}
        </span>
      </div>
      <div className="w-[72px] shrink-0 flex justify-end">
        <button
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
      </div>
    </div>
  )
}

export default function EntradaMensalList() {
  const { unidadeId } = useParams<{ unidadeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const api = useApi()

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
  }, [unidadeId, mes])

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

  const filtrados = itens
    .filter(a => filtro === 'todos' || a.statusCumprimento === filtro)
    .sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0
      if (coluna === 'nome')       { va = a.indicador.nome;              vb = b.indicador.nome }
      if (coluna === 'meta')       { va = a.metaVigenteMensal ?? 0;      vb = b.metaVigenteMensal ?? 0 }
      if (coluna === 'realizado')  { va = a.valorRealizado ?? -1;        vb = b.valorRealizado ?? -1 }
      if (coluna === 'percentual') { va = a.percentualCumprimento ?? -1; vb = b.percentualCumprimento ?? -1 }
      if (coluna === 'status')     { va = a.statusCumprimento;           vb = b.statusCumprimento }
      if (va < vb) return asc ? -1 : 1
      if (va > vb) return asc ?  1 : -1
      return 0
    })

  const stats = {
    total:     itens.length,
    atingidos: itens.filter(a => a.statusCumprimento === 'atingido').length,
    parciais:  itens.filter(a => a.statusCumprimento === 'parcial').length,
    pendentes: itens.filter(a => a.statusCumprimento === 'pendente').length,
  }

  function handleSalvo(atualizado: AcompanhamentoRecord) {
    setItens(prev => {
      const idx = prev.findIndex(a => a.indicadorId === atualizado.indicadorId)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = atualizado
      return next
    })
    setModal(null)
  }

  const SortBtn = ({ c, label }: { c: Coluna; label: string }) => (
    <button onClick={() => toggleSort(c)} className="flex items-center gap-0.5 hover:text-primary transition-colors">
      {label}{coluna === c ? (asc ? ' ↑' : ' ↓') : ''}
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/entrada-mensal')}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary">{nomeUnidade || 'Entrada Mensal'}</h1>
        </div>
        <input
          type="month"
          value={mesInput}
          onChange={handleMesChange}
          className="rounded-xl border border-border px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Total',     value: stats.total,     cls: 'text-text-primary' },
          { label: 'Atingidos', value: stats.atingidos,  cls: 'text-status-ok' },
          { label: 'Parciais',  value: stats.parciais,   cls: 'text-status-warn' },
          { label: 'Pendentes', value: stats.pendentes,  cls: 'text-text-secondary' },
        ] as const).map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-text-secondary">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'atingido', 'parcial', 'nao_atingido', 'pendente'] as const).map(f => (
          <button
            key={f}
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

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-secondary">Nenhum indicador encontrado.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 640 }}>
              {/* Header da tabela */}
              <div className="flex items-center px-4 py-2.5 bg-surface-alt border-b border-border text-xs font-medium text-text-secondary gap-2">
                <div className="flex-[2]"><SortBtn c="nome" label="Indicador" /></div>
                <div className="w-[70px] shrink-0">Tipo</div>
                <div className="w-[90px] shrink-0 text-right"><SortBtn c="meta" label="Meta" /></div>
                <div className="w-[90px] shrink-0 text-right"><SortBtn c="realizado" label="Realizado" /></div>
                <div className="w-[70px] shrink-0 text-right"><SortBtn c="percentual" label="%" /></div>
                <div className="w-[80px] shrink-0"><SortBtn c="status" label="Status" /></div>
                <div className="w-[72px] shrink-0" />
              </div>
              {/* Body */}
              <List<RowData>
                rowComponent={Row}
                rowCount={filtrados.length}
                rowHeight={ROW_HEIGHT}
                style={{ height: Math.min(filtrados.length * ROW_HEIGHT, 520) }}
                rowProps={{ itens: filtrados, onAbrir: setModal }}
              />
            </div>
          </div>
        </div>
      )}

      {modal && (
        <EntradaMensalModal
          acompanhamento={modal}
          onSalvo={handleSalvo}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  )
}
