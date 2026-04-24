import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { List, type RowComponentProps } from 'react-window'
import {
  Target, Plus, Search, RefreshCw, Edit3, Trash2,
  CheckCircle, XCircle, ChevronUp, ChevronDown, ChevronsUpDown,
  X as XIcon, ArrowLeft,
} from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { MetaRecord, MetaPapel } from './types'
import {
  STATUS_LABELS, STATUS_BADGE, STATUS_DOT,
  formatarValor, formatarData, unwrap, mockMetas, PAPEL_LABEL,
} from './types'
import type { IndicadorRecord } from '../Indicadores/types'
import { mockIndicadores } from '../Indicadores/types'
import MetasFormModal from './MetasFormModal'
import MetasDeleteModal from './MetasDeleteModal'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'ok' | 'erro'; msg: string }
let toastId = 0

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-border-subtle px-4 py-3">
      {[24, 56, 120, 100, 100, 100, 100, 56, 100, 80, 80].map((w, i) => (
        <div key={i} className="h-3.5 rounded bg-surface-alt" style={{ width: w, flexShrink: 0 }} />
      ))}
      <div className="h-5 w-16 shrink-0 rounded-full bg-surface-alt" />
      <div className="ml-auto flex gap-2">
        <div className="h-7 w-7 rounded-lg bg-surface-alt" />
        <div className="h-7 w-7 rounded-lg bg-surface-alt" />
      </div>
    </div>
  )
}

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortKey = 'versao' | 'nome' | 'vigenciaInicio' | 'metaMensal' | 'metaValorQualit' | 'metaAnual' | 'status'
type SortDir = 'asc' | 'desc'

// ── Column layout ─────────────────────────────────────────────────────────────
// Exp(28) | Versão(72) | Nome(160) | Vigência(180) | Mensal | Qualit | Anual | Peso(56) | Medida | Status | Ações
const COL   = 'grid-cols-[28px_72px_160px_180px_100px_100px_100px_56px_90px_80px_72px]'
const MIN_W = 1128

// ── Display row (raiz ou componente expandido) ───────────────────────────────
interface DisplayRow {
  meta: MetaRecord
  depth: number
}

// ── Row props ─────────────────────────────────────────────────────────────────
interface RowProps {
  rows: DisplayRow[]
  canUpdate: boolean
  canDelete: boolean
  expandedIds: string[]
  onToggleExpand: (id: string) => void
  onEdit: (m: MetaRecord) => void
  onDelete: (m: MetaRecord) => void
}

// ── Row component (react-window v2 API) ───────────────────────────────────────
function papelCurto(p: MetaPapel | undefined): string {
  if (p === 'agregada') return 'Pkg'
  if (p === 'componente') return 'Cmp'
  return 'Avl'
}

function MetaRow({
  ariaAttributes,
  index,
  style,
  rows,
  canUpdate,
  canDelete,
  expandedIds,
  onToggleExpand,
  onEdit,
  onDelete,
}: RowComponentProps<RowProps>) {
  const dr = rows[index]
  if (!dr) return null
  const m = dr.meta
  const depth = dr.depth
  const papel = m.papel ?? 'avulsa'
  const kids = m.children && m.children.length > 0
  const isParent = papel === 'agregada' && kids
  const open = expandedIds.includes(m.id)

  return (
    <div
      style={style}
      role="row"
      aria-posinset={ariaAttributes['aria-posinset']}
      aria-setsize={ariaAttributes['aria-setsize']}
      aria-rowindex={index + 2}
      className={`grid ${COL} items-center gap-3 border-b border-border-subtle px-4 text-sm transition-colors hover:bg-hover ${
        depth > 0 ? 'bg-primary/5' : index % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/30'
      }`}
    >
      {/* Expandir pacote */}
      <div role="cell" className="flex justify-center">
        {isParent ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Recolher componentes' : 'Expandir componentes'}
            onClick={() => onToggleExpand(m.id)}
            className="rounded p-0.5 text-text-muted hover:bg-hover hover:text-text-primary"
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : (
          <span className="inline-block w-4" />
        )}
      </div>

      {/* Versão + papel */}
      <div role="cell" className="min-w-0" style={{ paddingLeft: depth > 0 ? 8 : 0 }}>
        <p className="font-mono text-xs font-semibold text-text-primary">
          {depth > 0 ? '↳ ' : ''}v{m.versao}
        </p>
        <p className="text-[10px] text-text-faint" title={PAPEL_LABEL[papel]}>
          {papelCurto(m.papel)}
        </p>
      </div>

      {/* Nome */}
      <div role="cell" className="min-w-0" title={m.nome || undefined}>
        <p className="line-clamp-2 text-xs text-text-primary">
          {m.nome || m.observacoes || '—'}
        </p>
      </div>

      {/* Vigência */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-primary">
          {formatarData(m.vigenciaInicio)}
          {' → '}
          {m.vigenciaFim ? formatarData(m.vigenciaFim) : <span className="text-status-ok">em vigor</span>}
        </p>
      </div>

      {/* Meta Mensal */}
      <div role="cell" className="text-right">
        <span className="font-mono text-xs text-text-primary">
          {formatarValor(m.metaMensal)}
        </span>
      </div>

      {/* Meta Qualit */}
      <div role="cell" className="text-right">
        <span className="font-mono text-xs text-text-primary">
          {formatarValor(m.metaValorQualit)}
        </span>
      </div>

      {/* Meta Anual */}
      <div role="cell" className="text-right">
        <span className="font-mono text-xs text-text-primary">
          {formatarValor(m.metaAnual)}
        </span>
      </div>

      {/* Peso (componente) */}
      <div role="cell" className="text-right">
        <span className="font-mono text-xs text-text-primary" title="Peso no grupo (média ponderada)">
          {m.peso != null && m.peso !== undefined ? m.peso : '—'}
        </span>
      </div>

      {/* Medida */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-secondary">{m.unidadeMedida || '—'}</p>
      </div>

      {/* Status */}
      <div role="cell">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[m.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[m.status]}`} aria-hidden="true" />
          {STATUS_LABELS[m.status]}
        </span>
      </div>

      {/* Ações (só raiz; componentes filhos na expansão) */}
      <div role="cell" className="flex items-center gap-1">
        {depth === 0 && canUpdate && (
          <button
            type="button"
            onClick={() => onEdit(m)}
            aria-label={`Editar versão ${m.versao}`}
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Edit3 size={15} />
          </button>
        )}
        {depth === 0 && canDelete && (
          <button
            type="button"
            onClick={() => onDelete(m)}
            aria-label={`Excluir versão ${m.versao}`}
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-status-bad-bg hover:text-status-bad focus-visible:outline focus-visible:outline-2 focus-visible:outline-status-bad"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MetasList() {
  const { indicadorId } = useParams<{ indicadorId: string }>()
  const navigate = useNavigate()
  const { get, del } = useApi()
  const { canInsert, canUpdate, canDelete } = usePermission('metas')

  const [lista, setLista]                     = useState<MetaRecord[]>([])
  const [loading, setLoading]                 = useState(true)
  const [indicador, setIndicador]             = useState<IndicadorRecord | null>(null)
  const [indicadorLoading, setIndicadorLoading] = useState(true)
  const [deletingId, setDeletingId]           = useState<string | null>(null)
  const [busca, setBusca]                     = useState('')
  const [filtroStatus, setFiltroStatus]       = useState<'' | MetaRecord['status']>('')
  const [sortKey, setSortKey]                 = useState<SortKey>('versao')
  const [sortDir, setSortDir]                 = useState<SortDir>('desc')
  const [toasts, setToasts]                   = useState<Toast[]>([])
  const [expandedIds, setExpandedIds]         = useState<string[]>([])

  const [formModal, setFormModal]     = useState<{ open: boolean; meta?: MetaRecord }>({ open: false })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; meta?: MetaRecord }>({ open: false })

  const tableRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(MIN_W)

  useEffect(() => {
    if (!tableRef.current) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setTableWidth(w)
    })
    obs.observe(tableRef.current)
    return () => obs.disconnect()
  }, [])

  const addToast = useCallback((type: Toast['type'], msg: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const fetchLista = useCallback(async () => {
    if (!indicadorId) return
    setLoading(true)
    try {
      const res = await get<MetaRecord[] | { data: MetaRecord[] }>(`/metas?indicadorId=${indicadorId}`)
      setLista(unwrap(res))
    } catch {
      if (import.meta.env.DEV) {
        setLista(mockMetas.filter(m => m.indicadorId === indicadorId))
      }
    } finally {
      setLoading(false)
    }
  }, [get, indicadorId])

  const fetchIndicador = useCallback(async () => {
    if (!indicadorId) return
    setIndicadorLoading(true)
    try {
      const res = await get<IndicadorRecord | { data: IndicadorRecord }>(`/indicadores/${indicadorId}`)
      setIndicador(unwrap(res))
    } catch {
      if (import.meta.env.DEV) {
        setIndicador(mockIndicadores.find(i => i.id === indicadorId) ?? null)
      }
    } finally {
      setIndicadorLoading(false)
    }
  }, [get, indicadorId])

  useEffect(() => {
    fetchLista()
    fetchIndicador()
  }, [fetchLista, fetchIndicador])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalVigentes = useMemo(() => lista.filter(m => m.status === 'vigente').length, [lista])
  const metaVigente   = useMemo(() => lista.find(m => m.status === 'vigente') ?? null, [lista])
  const versaoAtual   = useMemo(
    () => lista.length > 0 ? Math.max(...lista.map(m => m.versao)) : 0,
    [lista],
  )

  const metaAtualValor = useMemo(() => {
    if (!metaVigente) return '—'
    if (metaVigente.metaMensal != null) return formatarValor(metaVigente.metaMensal) + '/mês'
    if (metaVigente.metaValorQualit != null) return formatarValor(metaVigente.metaValorQualit)
    if (metaVigente.metaAnual != null) return formatarValor(metaVigente.metaAnual) + '/ano'
    return '—'
  }, [metaVigente])

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let items = [...lista]

    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(m =>
        String(m.versao).includes(q) ||
        (m.nome ?? '').toLowerCase().includes(q) ||
        (m.unidadeMedida ?? '').toLowerCase().includes(q) ||
        (m.observacoes ?? '').toLowerCase().includes(q),
      )
    }
    if (filtroStatus) items = items.filter(m => m.status === filtroStatus)

    items.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'versao':         va = a.versao;            vb = b.versao;            break
        case 'nome':           va = a.nome ?? '';      vb = b.nome ?? '';      break
        case 'vigenciaInicio': va = a.vigenciaInicio ?? ''; vb = b.vigenciaInicio ?? ''; break
        case 'metaMensal':     va = a.metaMensal ?? 0;   vb = b.metaMensal ?? 0;   break
        case 'metaValorQualit': va = a.metaValorQualit ?? 0; vb = b.metaValorQualit ?? 0; break
        case 'metaAnual':      va = a.metaAnual ?? 0;    vb = b.metaAnual ?? 0;    break
        case 'status':         va = a.status;            vb = b.status;            break
        default: return 0
      }
      const cmp = typeof va === 'number'
        ? va - (vb as number)
        : String(va).localeCompare(String(vb), 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [lista, busca, filtroStatus, sortKey, sortDir])

  const displayRows: DisplayRow[] = useMemo(() => {
    const ex = new Set(expandedIds)
    const out: DisplayRow[] = []
    for (const m of filtrados) {
      out.push({ meta: m, depth: 0 })
      const kids = m.children
      if (m.papel === 'agregada' && kids?.length && ex.has(m.id)) {
        for (const ch of kids) {
          out.push({ meta: ch, depth: 1 })
        }
      }
    }
    return out
  }, [filtrados, expandedIds])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }, [])

  function handleSort(col: SortKey) {
    setSortDir(prev => sortKey === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setSortKey(col)
  }

  const handleSalvo = useCallback((meta: MetaRecord) => {
    setLista(prev => {
      const idx = prev.findIndex(m => m.id === meta.id)
      return idx >= 0
        ? prev.map(m => m.id === meta.id ? meta : m)
        : [meta, ...prev]
    })
    setFormModal({ open: false })
    addToast('ok', `Meta versão ${meta.versao} salva com sucesso.`)
  }, [addToast])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.meta) return
    const meta = deleteModal.meta
    setDeletingId(meta.id)
    try {
      await del(`/metas/${meta.id}`)
      setLista(prev => prev.filter(m => m.id !== meta.id))
      setDeleteModal({ open: false })
      addToast('ok', `Meta versão ${meta.versao} excluída com sucesso.`)
    } catch (err) {
      const status   = err instanceof ApiError ? err.status : 0
      const rawMsg   = err instanceof Error    ? err.message : ''
      const isNetErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      if (import.meta.env.DEV && (status === 401 || status === 404 || isNetErr)) {
        setLista(prev => prev.filter(m => m.id !== meta.id))
        setDeleteModal({ open: false })
        addToast('ok', `Meta versão ${meta.versao} excluída com sucesso.`)
      } else {
        addToast('erro', `Erro ao excluir: ${rawMsg || 'tente novamente.'}`)
      }
    } finally {
      setDeletingId(null)
    }
  }, [deleteModal.meta, del, addToast])

  function SortBtn({ col, children }: { col: SortKey; children: React.ReactNode }) {
    return (
      <button
        type="button"
        onClick={() => handleSort(col)}
        className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-white/80 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded"
        aria-sort={sortKey === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {children}
        {sortKey === col
          ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          : <ChevronsUpDown size={13} className="text-white/40" />
        }
      </button>
    )
  }

  const rowProps: RowProps = useMemo(
    () => ({
      rows: displayRows,
      canUpdate,
      canDelete,
      expandedIds,
      onToggleExpand: toggleExpand,
      onEdit: (m) => {
        if (m.papel === 'agregada' && m.children && m.children.length > 0) {
          addToast('erro', 'Pacote decomposto: edição ainda não está disponível. Exclua a versão e crie outra, se necessário.')
          return
        }
        setFormModal({ open: true, meta: m })
      },
      onDelete: (m) => setDeleteModal({ open: true, meta: m }),
    }),
    [displayRows, canUpdate, canDelete, expandedIds, toggleExpand, addToast],
  )

  const ROW_HEIGHT = 56
  const listHeight = Math.min(displayRows.length * ROW_HEIGHT, 520)
  const hasFilters = busca || filtroStatus

  const statsCards = [
    { label: 'Total',        value: lista.length,   valueClr: 'text-primary' },
    { label: 'Vigentes',     value: totalVigentes,  valueClr: 'text-status-ok' },
    { label: 'Meta Atual',   value: metaAtualValor, valueClr: 'text-primary', mono: true },
    { label: 'Versão Atual', value: versaoAtual > 0 ? `v${versaoAtual}` : '—', valueClr: 'text-text-primary', mono: true },
  ]

  if (!indicadorId) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Target size={48} className="text-text-faint" />
        <p className="text-text-secondary">Nenhum indicador selecionado.</p>
        <button
          type="button"
          onClick={() => navigate('/metas')}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <ArrowLeft size={16} />
          Voltar às Metas
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5">

      {/* ── Toasts ── */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2" aria-live="polite" aria-label="Notificações">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === 'ok'
                ? 'border-status-ok-border bg-status-ok-bg text-status-ok'
                : 'border-status-bad-border bg-status-bad-bg text-status-bad'
            }`}
          >
            {t.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/metas')}
            aria-label="Voltar às Metas"
            className="mt-0.5 rounded-xl border border-border-subtle bg-surface p-2 text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Metas Anuais</h1>
              {indicadorLoading ? (
                <div className="h-4 w-56 animate-pulse rounded bg-surface-alt" />
              ) : (
                <p className="text-sm text-text-muted">
                  {indicador ? (
                    <>
                      <span className="font-medium text-text-secondary">{indicador.nome}</span>
                      {indicador.unidade && (
                        <> · {indicador.unidade.nome}</>
                      )}
                      {' · '}
                    </>
                  ) : null}
                  {loading
                    ? 'Carregando…'
                    : `${lista.length} versão${lista.length !== 1 ? 'ões' : ''} cadastrada${lista.length !== 1 ? 's' : ''}`
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLista}
            disabled={loading}
            aria-label="Recarregar lista"
            className="rounded-xl border border-border-subtle bg-surface p-2.5 text-text-muted transition-colors hover:bg-hover hover:text-text-primary disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {canInsert && (
            <button
              type="button"
              onClick={() => setFormModal({ open: true })}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Plus size={16} />
              Nova Meta
            </button>
          )}
        </div>
      </div>

      {/* ── Stats cards ── */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map(c => (
            <div key={c.label} className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
              <div className="border-b border-border-subtle bg-surface-alt px-4 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{c.label}</p>
              </div>
              <div className="px-4 py-3">
                <p className={`font-bold tabular-nums ${c.mono ? 'font-mono text-lg' : 'text-2xl'} ${c.valueClr}`}>
                  {c.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, versão, medida…"
            aria-label="Buscar metas"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text-secondary">
              <XIcon size={14} />
            </button>
          )}
        </div>

        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
          aria-label="Filtrar por status"
          className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todos os status</option>
          <option value="vigente">Vigente</option>
          <option value="encerrada">Encerrada</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setBusca(''); setFiltroStatus('') }}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <XIcon size={12} />
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-md">

        <div className="min-h-0 flex-1 overflow-x-auto">
          <div
            ref={tableRef}
            style={{ minWidth: MIN_W }}
            className="flex flex-col"
          >
            {/* Header */}
            <div role="rowgroup" className="shrink-0 border-b border-border-subtle bg-primary text-white">
              <div role="row" aria-rowindex={1} className={`grid ${COL} items-center gap-3 px-4 py-3 text-xs`}>
                <div role="columnheader" className="font-medium text-white/50" />
                <div role="columnheader"><SortBtn col="versao">Versão</SortBtn></div>
                <div role="columnheader"><SortBtn col="nome">Nome</SortBtn></div>
                <div role="columnheader"><SortBtn col="vigenciaInicio">Vigência</SortBtn></div>
                <div role="columnheader" className="text-right"><SortBtn col="metaMensal">Mensal</SortBtn></div>
                <div role="columnheader" className="text-right"><SortBtn col="metaValorQualit">Qualit.</SortBtn></div>
                <div role="columnheader" className="text-right"><SortBtn col="metaAnual">Anual</SortBtn></div>
                <div role="columnheader" className="text-right font-medium text-white/70" title="Peso na média ponderada (componentes)">Peso</div>
                <div role="columnheader" className="font-medium text-white/70">Medida</div>
                <div role="columnheader"><SortBtn col="status">Status</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Ações</div>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div role="status" aria-label="Carregando metas">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : displayRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
                  <Target size={28} />
                </div>
                <p className="font-medium text-text-secondary">
                  {hasFilters ? 'Nenhuma meta encontrada' : 'Nenhuma meta cadastrada'}
                </p>
                <p className="text-sm text-text-muted">
                  {hasFilters
                    ? 'Tente outros termos ou limpe os filtros.'
                    : canInsert
                      ? 'Clique em "Nova Meta" para começar.'
                      : 'Entre em contato com o administrador.'}
                </p>
              </div>
            ) : (
              <div
                role="table"
                aria-label="Lista de Metas"
                aria-rowcount={displayRows.length + 1}
              >
                <div role="rowgroup">
                  <List
                    rowComponent={MetaRow}
                    rowCount={displayRows.length}
                    rowHeight={ROW_HEIGHT}
                    rowProps={rowProps}
                    overscanCount={5}
                    style={{ height: listHeight, width: tableWidth }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!loading && displayRows.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
            <span>
              Exibindo <strong className="text-text-secondary">{displayRows.length}</strong> linha
              {displayRows.length !== 1 ? 's' : ''} ({filtrados.length} versão
              {filtrados.length !== 1 ? 'ões' : ''} raiz)
            </span>
            <span>
              Ordenado por: <strong className="text-text-secondary">{sortKey}</strong>{' '}
              ({sortDir === 'asc' ? '↑ crescente' : '↓ decrescente'})
            </span>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {formModal.open && (
        <MetasFormModal
          meta={formModal.meta}
          indicadorId={indicadorId}
          indicadorTipo={indicador?.tipo ?? 'producao'}
          indicadorVigencia={indicador
            ? {
                vigenciaInicio: indicador.vigenciaInicio ?? null,
                vigenciaFim:    indicador.vigenciaFim ?? null,
                prazoImplantacao: indicador.prazoImplantacao ?? null,
              }
            : null}
          onSalvo={handleSalvo}
          onFechar={() => setFormModal({ open: false })}
        />
      )}
      {deleteModal.open && deleteModal.meta && (
        <MetasDeleteModal
          meta={deleteModal.meta}
          loading={deletingId === deleteModal.meta.id}
          onConfirmar={handleDeleteConfirm}
          onFechar={() => setDeleteModal({ open: false })}
        />
      )}
    </div>
  )
}
