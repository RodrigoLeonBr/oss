import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, type RowComponentProps } from 'react-window'
import {
  Hospital, Plus, Search, RefreshCw, Edit3, Trash2,
  CheckCircle, XCircle, ChevronUp, ChevronDown, ChevronsUpDown,
  X as XIcon, Filter, BarChart3,
} from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'
import type { UnidadeRecord } from './types'
import {
  TIPO_LABELS,
  STATUS_LABELS, STATUS_BADGE, STATUS_DOT,
  formatarCnesOuDoc, tipoLabelSafe, tipoBadgeSafe, unwrap,
} from './types'
import type { ContratoRecord } from '../Contratos/types'
import UnidadesFormModal from './UnidadesFormModal'
import UnidadesDeleteModal from './UnidadesDeleteModal'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'ok' | 'erro'; msg: string }
let toastId = 0

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-border-subtle px-4 py-3">
      {[160, 140, 130, 100, 80, 70, 60].map((w, i) => (
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
type SortKey = 'nome' | 'contratoNumero' | 'tipo' | 'capacidade' | 'status'
type SortDir = 'asc' | 'desc'

// ── Column layout ─────────────────────────────────────────────────────────────
// Nome(2fr) + Contrato(150) + Endereço(170) + CNPJ(130) + Tipo(100) + Cap(80) + Status(76) + Ações(72)
// Ações agora tem 3 botões (Indicadores + Editar + Excluir) → 96px
const COL   = 'grid-cols-[minmax(160px,2fr)_150px_170px_130px_100px_80px_76px_96px]'
const MIN_W = 1080

// ── Row props ─────────────────────────────────────────────────────────────────
interface RowProps {
  rows: UnidadeRecord[]
  canWrite: boolean
  onEdit: (u: UnidadeRecord) => void
  onDelete: (u: UnidadeRecord) => void
  onIndicadores: (u: UnidadeRecord) => void
}

// ── Row component (react-window v2 API) ───────────────────────────────────────
function UnidadeRow({
  ariaAttributes,
  index,
  style,
  rows,
  canWrite,
  onEdit,
  onDelete,
  onIndicadores,
}: RowComponentProps<RowProps>) {
  const u = rows[index]
  if (!u) return null

  return (
    <div
      style={style}
      role="row"
      aria-posinset={ariaAttributes['aria-posinset']}
      aria-setsize={ariaAttributes['aria-setsize']}
      aria-rowindex={index + 2}
      className={`grid ${COL} items-center gap-3 border-b border-border-subtle px-4 text-sm transition-colors hover:bg-hover ${
        index % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/30'
      }`}
    >
      {/* Nome */}
      <div role="cell" className="min-w-0">
        <p className="truncate font-medium text-text-primary" title={u.nome}>{u.nome}</p>
      </div>

      {/* Contrato / OSS */}
      <div role="cell" className="min-w-0">
        {u.contrato ? (
          <>
            <p className="truncate font-mono text-xs font-bold text-text-primary" title={u.contrato.numeroContrato}>
              {u.contrato.numeroContrato}
            </p>
            {u.contrato.oss && (
              <p className="truncate text-[10px] text-text-muted" title={u.contrato.oss.nome}>
                {u.contrato.oss.nome}
              </p>
            )}
          </>
        ) : (
          <p className="font-mono text-xs text-text-muted">{u.contratoId.slice(0, 8)}…</p>
        )}
      </div>

      {/* Endereço */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-secondary" title={u.endereco}>{u.endereco}</p>
      </div>

      {/* CNES / doc */}
      <div role="cell" className="min-w-0">
        <p className="truncate font-mono text-xs text-text-secondary" title={u.cnes ?? undefined}>
          {formatarCnesOuDoc(u.cnes)}
        </p>
      </div>

      {/* Tipo */}
      <div role="cell">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tipoBadgeSafe(u.tipo)}`}>
          {tipoLabelSafe(u.tipo)}
        </span>
      </div>

      {/* Capacidade */}
      <div role="cell" className="text-xs font-semibold text-text-primary text-right">
        {u.capacidade.toLocaleString('pt-BR')}
      </div>

      {/* Status */}
      <div role="cell">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[u.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[u.status]}`} aria-hidden="true" />
          {STATUS_LABELS[u.status]}
        </span>
      </div>

      {/* Ações */}
      <div role="cell" className="flex items-center gap-1">
        {/* Ver Indicadores — visível para todos os perfis autenticados */}
        <button
          type="button"
          onClick={() => onIndicadores(u)}
          aria-label={`Ver indicadores de ${u.nome}`}
          title="Ver Indicadores"
          className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
        >
          <BarChart3 size={15} />
        </button>
        {canWrite && (
          <>
            <button
              type="button"
              onClick={() => onEdit(u)}
              aria-label={`Editar unidade ${u.nome}`}
              className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Edit3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(u)}
              aria-label={`Excluir unidade ${u.nome}`}
              className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-status-bad-bg hover:text-status-bad focus-visible:outline focus-visible:outline-2 focus-visible:outline-status-bad"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UnidadesList() {
  const navigate = useNavigate()
  const { get, del } = useApi()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(['admin', 'gestor_sms'])

  // ── State ──────────────────────────────────────────────────────────────────
  const [lista, setLista]                   = useState<UnidadeRecord[]>([])
  const [loading, setLoading]               = useState(true)
  const [contratosList, setContratosList]   = useState<ContratoRecord[]>([])
  const [contratosLoading, setContratosLoading] = useState(true)
  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [busca, setBusca]                   = useState('')
  const [filtroContrato, setFiltroContrato] = useState('')
  const [filtroTipo, setFiltroTipo]         = useState<'' | UnidadeRecord['tipo']>('')
  const [filtroStatus, setFiltroStatus]     = useState<'' | UnidadeRecord['status']>('')
  const [sortKey, setSortKey]               = useState<SortKey>('nome')
  const [sortDir, setSortDir]               = useState<SortDir>('asc')
  const [toasts, setToasts]                 = useState<Toast[]>([])

  const [formModal, setFormModal]     = useState<{ open: boolean; unidade?: UnidadeRecord }>({ open: false })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; unidade?: UnidadeRecord }>({ open: false })

  const buscaRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(MIN_W)

  // ── ResizeObserver ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tableRef.current) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setTableWidth(w)
    })
    obs.observe(tableRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Toast helper ───────────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast['type'], msg: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ── Fetch unidades ─────────────────────────────────────────────────────────
  const fetchLista = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<UnidadeRecord[] | { data: UnidadeRecord[] }>('/unidades')
      setLista(unwrap(res))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível carregar as unidades.'
      setLista([])
      if (err instanceof ApiError && err.status === 401) {
        addToast('erro', 'Sessão expirada ou não autenticado. Faça login novamente.')
      } else {
        addToast('erro', msg)
      }
    } finally {
      setLoading(false)
    }
  }, [get, addToast])

  // ── Fetch contratos (dropdown de filtro e formulário) ──────────────────────
  const fetchContratos = useCallback(async () => {
    setContratosLoading(true)
    try {
      const res = await get<ContratoRecord[] | { data: ContratoRecord[] }>('/contratos')
      setContratosList(unwrap(res))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível carregar os contratos.'
      setContratosList([])
      if (err instanceof ApiError && err.status === 401) {
        addToast('erro', 'Sessão expirada ou não autenticado. Faça login novamente.')
      } else {
        addToast('erro', msg)
      }
    } finally {
      setContratosLoading(false)
    }
  }, [get, addToast])

  useEffect(() => {
    fetchLista()
    fetchContratos()
  }, [fetchLista, fetchContratos])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalAtivas     = useMemo(() => lista.filter(u => u.status === 'ativa').length,   [lista])
  const totalHospitais  = useMemo(() => lista.filter(u => u.tipo === 'hospital').length,  [lista])
  const totalCapacidade = useMemo(() => lista.filter(u => u.status === 'ativa')
    .reduce((s, u) => s + u.capacidade, 0), [lista])

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let items = [...lista]

    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(u =>
        u.nome.toLowerCase().includes(q) ||
        u.endereco.toLowerCase().includes(q) ||
        (u.contrato?.numeroContrato ?? '').toLowerCase().includes(q) ||
        (u.contrato?.oss?.nome ?? '').toLowerCase().includes(q),
      )
    }
    if (filtroContrato) items = items.filter(u => u.contratoId === filtroContrato)
    if (filtroTipo)     items = items.filter(u => u.tipo === filtroTipo)
    if (filtroStatus)   items = items.filter(u => u.status === filtroStatus)

    items.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'nome':            va = a.nome;                              vb = b.nome;                              break
        case 'contratoNumero':  va = a.contrato?.numeroContrato ?? '';    vb = b.contrato?.numeroContrato ?? '';    break
        case 'tipo':            va = a.tipo;                              vb = b.tipo;                              break
        case 'capacidade':      va = a.capacidade;                        vb = b.capacidade;                        break
        case 'status':          va = a.status;                            vb = b.status;                            break
        default: return 0
      }
      const cmp = typeof va === 'number'
        ? va - (vb as number)
        : String(va).localeCompare(String(vb), 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [lista, busca, filtroContrato, filtroTipo, filtroStatus, sortKey, sortDir])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSort(col: SortKey) {
    setSortDir(prev => sortKey === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setSortKey(col)
  }

  const handleSalvo = useCallback((unidade: UnidadeRecord) => {
    setLista(prev => {
      const idx = prev.findIndex(u => u.id === unidade.id)
      return idx >= 0
        ? prev.map(u => u.id === unidade.id ? unidade : u)
        : [unidade, ...prev]
    })
    setFormModal({ open: false })
    addToast('ok', `Unidade "${unidade.nome}" salva com sucesso.`)
  }, [addToast])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.unidade) return
    const unidade = deleteModal.unidade
    setDeletingId(unidade.id)
    try {
      await del(`/unidades/${unidade.id}`)
      setLista(prev => prev.filter(u => u.id !== unidade.id))
      setDeleteModal({ open: false })
      addToast('ok', `Unidade "${unidade.nome}" excluída com sucesso.`)
    } catch (err) {
      const status   = err instanceof ApiError ? err.status : 0
      const rawMsg   = err instanceof Error   ? err.message : ''
      const isNetErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      if (import.meta.env.DEV && (status === 401 || status === 404 || isNetErr)) {
        setLista(prev => prev.filter(u => u.id !== unidade.id))
        setDeleteModal({ open: false })
        addToast('ok', `Unidade "${unidade.nome}" excluída com sucesso.`)
      } else {
        addToast('erro', `Erro ao excluir: ${rawMsg || 'tente novamente.'}`)
      }
    } finally {
      setDeletingId(null)
    }
  }, [deleteModal.unidade, del, addToast])

  // ── Sort button ────────────────────────────────────────────────────────────
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

  // ── Row props ──────────────────────────────────────────────────────────────
  const rowProps: RowProps = useMemo(
    () => ({
      rows: filtrados,
      canWrite,
      onEdit:         (u) => setFormModal({ open: true, unidade: u }),
      onDelete:       (u) => setDeleteModal({ open: true, unidade: u }),
      onIndicadores:  (u) => navigate(`/indicadores/${u.id}`),
    }),
    [filtrados, canWrite, navigate],
  )

  const ROW_HEIGHT = 56
  const listHeight = Math.min(filtrados.length * ROW_HEIGHT, 560)

  const hasFilters = busca || filtroContrato || filtroTipo || filtroStatus

  // ── Stats cards ────────────────────────────────────────────────────────────
  const statsCards = [
    { label: 'Total',               value: lista.length,                              valueClr: 'text-primary' },
    { label: 'Ativas',              value: totalAtivas,                               valueClr: 'text-status-ok' },
    { label: 'Hospitais',           value: totalHospitais,                            valueClr: 'text-text-primary' },
    { label: 'Capacidade (ativas)', value: totalCapacidade.toLocaleString('pt-BR'),   valueClr: 'text-primary' },
  ]

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
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Hospital size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Unidades de Saúde</h1>
            <p className="text-sm text-text-muted">
              {loading
                ? 'Carregando…'
                : `${lista.length} unidade${lista.length !== 1 ? 's' : ''} cadastrada${lista.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { fetchLista(); fetchContratos() }}
            disabled={loading}
            aria-label="Recarregar lista"
            className="rounded-xl border border-border-subtle bg-surface p-2.5 text-text-muted transition-colors hover:bg-hover hover:text-text-primary disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => setFormModal({ open: true })}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Plus size={16} />
              Nova Unidade
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
                <p className={`text-2xl font-bold tabular-nums ${c.valueClr}`}>
                  {c.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Busca */}
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, endereço ou contrato…"
            aria-label="Buscar unidades"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text-secondary">
              <XIcon size={14} />
            </button>
          )}
        </div>

        {/* Contrato filter */}
        <div className="relative flex items-center">
          <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <select
            value={filtroContrato}
            onChange={e => setFiltroContrato(e.target.value)}
            aria-label="Filtrar por contrato"
            className="appearance-none rounded-xl border border-border-subtle bg-surface py-2 pl-8 pr-6 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Todos os contratos</option>
            {contratosList.map(c => (
              <option key={c.id} value={c.id}>
                {c.numeroContrato}{c.oss ? ` — ${c.oss.nome.split(' ').slice(0, 3).join(' ')}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo filter */}
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as typeof filtroTipo)}
          aria-label="Filtrar por tipo"
          className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
          aria-label="Filtrar por status"
          className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todos os status</option>
          <option value="ativa">Ativa</option>
          <option value="inativa">Inativa</option>
        </select>

        {/* Pill resultados + limpar */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setBusca(''); setFiltroContrato(''); setFiltroTipo(''); setFiltroStatus('') }}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <XIcon size={12} />
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-md">

        {/* Scroll horizontal — header + body rolam juntos */}
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div
            ref={tableRef}
            style={{ minWidth: MIN_W }}
            className="flex flex-col"
          >
            {/* Header */}
            <div role="rowgroup" className="shrink-0 border-b border-border-subtle bg-primary text-white">
              <div role="row" aria-rowindex={1} className={`grid ${COL} items-center gap-3 px-4 py-3 text-xs`}>
                <div role="columnheader"><SortBtn col="nome">Nome</SortBtn></div>
                <div role="columnheader"><SortBtn col="contratoNumero">Contrato / OSS</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Endereço</div>
                <div role="columnheader" className="font-medium text-white/70">CNES / doc.</div>
                <div role="columnheader"><SortBtn col="tipo">Tipo</SortBtn></div>
                <div role="columnheader" className="text-right"><SortBtn col="capacidade">Cap.</SortBtn></div>
                <div role="columnheader"><SortBtn col="status">Status</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Ações</div>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div role="status" aria-label="Carregando unidades">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
                  <Hospital size={28} />
                </div>
                <p className="font-medium text-text-secondary">
                  {hasFilters ? 'Nenhuma unidade encontrada' : 'Nenhuma unidade cadastrada'}
                </p>
                <p className="text-sm text-text-muted">
                  {hasFilters
                    ? 'Tente outros termos ou limpe os filtros.'
                    : canWrite
                      ? 'Clique em "Nova Unidade" para começar.'
                      : 'Entre em contato com o administrador.'}
                </p>
              </div>
            ) : (
              <div
                role="table"
                aria-label="Lista de Unidades de Saúde"
                aria-rowcount={filtrados.length + 1}
              >
                <div role="rowgroup">
                  <List
                    rowComponent={UnidadeRow}
                    rowCount={filtrados.length}
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

        {/* Footer — fora do scroll horizontal */}
        {!loading && filtrados.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
            <span>
              Exibindo <strong className="text-text-secondary">{filtrados.length}</strong> de{' '}
              <strong className="text-text-secondary">{lista.length}</strong> unidades
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
        <UnidadesFormModal
          unidade={formModal.unidade}
          contratosList={contratosList}
          contratosLoading={contratosLoading}
          onSalvo={handleSalvo}
          onFechar={() => setFormModal({ open: false })}
        />
      )}
      {deleteModal.open && deleteModal.unidade && (
        <UnidadesDeleteModal
          unidade={deleteModal.unidade}
          loading={deletingId === deleteModal.unidade.id}
          onConfirmar={handleDeleteConfirm}
          onFechar={() => setDeleteModal({ open: false })}
        />
      )}
    </div>
  )
}
