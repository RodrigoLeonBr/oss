import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { List, type RowComponentProps } from 'react-window'
import {
  BarChart3, Plus, Search, RefreshCw, Edit3, Trash2,
  CheckCircle, XCircle, ChevronUp, ChevronDown, ChevronsUpDown,
  X as XIcon, ArrowLeft,
} from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'
import type { IndicadorRecord } from './types'
import {
  TIPO_LABELS, TIPO_BADGE,
  STATUS_LABELS, STATUS_BADGE, STATUS_DOT,
  formatarMeta, unwrap, mockIndicadores,
} from './types'
import type { UnidadeRecord } from '../Unidades/types'
import { mockUnidades } from '../Unidades/types'
import IndicadoresFormModal from './IndicadoresFormModal'
import IndicadoresDeleteModal from './IndicadoresDeleteModal'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'ok' | 'erro'; msg: string }
let toastId = 0

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-border-subtle px-4 py-3">
      {[180, 220, 80, 90, 90, 70].map((w, i) => (
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
type SortKey = 'nome' | 'tipo' | 'metaPadrao' | 'unidadeMedida' | 'status'
type SortDir = 'asc' | 'desc'

// ── Column layout ─────────────────────────────────────────────────────────────
// Nome(2fr) + Descrição(2fr) + Tipo(90) + Meta(90) + Medida(100) + Status(76) + Ações(72)
const COL   = 'grid-cols-[minmax(160px,2fr)_minmax(140px,2fr)_90px_90px_100px_76px_72px]'
const MIN_W = 880

// ── Row props ─────────────────────────────────────────────────────────────────
interface RowProps {
  rows: IndicadorRecord[]
  canWrite: boolean
  onEdit: (i: IndicadorRecord) => void
  onDelete: (i: IndicadorRecord) => void
}

// ── Row component (react-window v2 API) ───────────────────────────────────────
function IndicadorRow({
  ariaAttributes,
  index,
  style,
  rows,
  canWrite,
  onEdit,
  onDelete,
}: RowComponentProps<RowProps>) {
  const ind = rows[index]
  if (!ind) return null

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
        <p className="truncate font-medium text-text-primary" title={ind.nome}>{ind.nome}</p>
      </div>

      {/* Descrição */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-secondary" title={ind.descricao ?? ''}>
          {ind.descricao || <span className="text-text-faint italic">—</span>}
        </p>
      </div>

      {/* Tipo */}
      <div role="cell">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[ind.tipo]}`}>
          {TIPO_LABELS[ind.tipo]}
        </span>
      </div>

      {/* Meta Padrão */}
      <div role="cell" className="text-right">
        <span className="font-mono text-xs font-semibold text-text-primary">
          {formatarMeta(ind.metaPadrao)}
        </span>
      </div>

      {/* Unidade de Medida */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-secondary">{ind.unidadeMedida || '—'}</p>
      </div>

      {/* Status */}
      <div role="cell">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ind.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[ind.status]}`} aria-hidden="true" />
          {STATUS_LABELS[ind.status]}
        </span>
      </div>

      {/* Ações */}
      <div role="cell" className="flex items-center gap-1">
        {canWrite && (
          <>
            <button
              type="button"
              onClick={() => onEdit(ind)}
              aria-label={`Editar indicador ${ind.nome}`}
              className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Edit3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(ind)}
              aria-label={`Excluir indicador ${ind.nome}`}
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
export default function IndicadoresList() {
  const { unidadeId } = useParams<{ unidadeId: string }>()
  const navigate = useNavigate()
  const { get, del } = useApi()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(['admin', 'gestor_sms'])

  // ── State ──────────────────────────────────────────────────────────────────
  const [lista, setLista]               = useState<IndicadorRecord[]>([])
  const [loading, setLoading]           = useState(true)
  const [unidade, setUnidade]           = useState<UnidadeRecord | null>(null)
  const [unidadeLoading, setUnidadeLoading] = useState(true)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [busca, setBusca]               = useState('')
  const [filtroTipo, setFiltroTipo]     = useState<'' | IndicadorRecord['tipo']>('')
  const [filtroStatus, setFiltroStatus] = useState<'' | IndicadorRecord['status']>('')
  const [sortKey, setSortKey]           = useState<SortKey>('nome')
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [toasts, setToasts]             = useState<Toast[]>([])

  const [formModal, setFormModal]     = useState<{ open: boolean; indicador?: IndicadorRecord }>({ open: false })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; indicador?: IndicadorRecord }>({ open: false })

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

  // ── Fetch indicadores ──────────────────────────────────────────────────────
  const fetchLista = useCallback(async () => {
    if (!unidadeId) return
    setLoading(true)
    try {
      const res = await get<IndicadorRecord[] | { data: IndicadorRecord[] }>(
        `/indicadores?unidadeId=${unidadeId}`,
      )
      setLista(unwrap(res))
    } catch {
      if (import.meta.env.DEV) {
        setLista(mockIndicadores.filter(i => i.unidadeId === unidadeId))
      }
    } finally {
      setLoading(false)
    }
  }, [get, unidadeId])

  // ── Fetch unidade (contexto / breadcrumb) ──────────────────────────────────
  const fetchUnidade = useCallback(async () => {
    if (!unidadeId) return
    setUnidadeLoading(true)
    try {
      const res = await get<UnidadeRecord | { data: UnidadeRecord }>(`/unidades/${unidadeId}`)
      setUnidade(unwrap(res))
    } catch {
      if (import.meta.env.DEV) {
        setUnidade(mockUnidades.find(u => u.id === unidadeId) ?? null)
      }
    } finally {
      setUnidadeLoading(false)
    }
  }, [get, unidadeId])

  useEffect(() => {
    fetchLista()
    fetchUnidade()
  }, [fetchLista, fetchUnidade])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalAtivos     = useMemo(() => lista.filter(i => i.status === 'ativo').length,    [lista])
  const totalProducao   = useMemo(() => lista.filter(i => i.tipo === 'producao').length,   [lista])
  const totalQualidade  = useMemo(() => lista.filter(i => i.tipo === 'qualidade').length,  [lista])

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let items = [...lista]

    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(i =>
        i.nome.toLowerCase().includes(q) ||
        (i.descricao ?? '').toLowerCase().includes(q) ||
        (i.unidadeMedida ?? '').toLowerCase().includes(q),
      )
    }
    if (filtroTipo)   items = items.filter(i => i.tipo === filtroTipo)
    if (filtroStatus) items = items.filter(i => i.status === filtroStatus)

    items.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'nome':          va = a.nome;          vb = b.nome;          break
        case 'tipo':          va = a.tipo;          vb = b.tipo;          break
        case 'metaPadrao':    va = a.metaPadrao ?? 0; vb = b.metaPadrao ?? 0; break
        case 'unidadeMedida': va = a.unidadeMedida ?? ''; vb = b.unidadeMedida ?? ''; break
        case 'status':        va = a.status;        vb = b.status;        break
        default: return 0
      }
      const cmp = typeof va === 'number'
        ? va - (vb as number)
        : String(va).localeCompare(String(vb), 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [lista, busca, filtroTipo, filtroStatus, sortKey, sortDir])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSort(col: SortKey) {
    setSortDir(prev => sortKey === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setSortKey(col)
  }

  const handleSalvo = useCallback((indicador: IndicadorRecord) => {
    setLista(prev => {
      const idx = prev.findIndex(i => i.id === indicador.id)
      return idx >= 0
        ? prev.map(i => i.id === indicador.id ? indicador : i)
        : [indicador, ...prev]
    })
    setFormModal({ open: false })
    addToast('ok', `Indicador "${indicador.nome}" salvo com sucesso.`)
  }, [addToast])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.indicador) return
    const indicador = deleteModal.indicador
    setDeletingId(indicador.id)
    try {
      await del(`/indicadores/${indicador.id}`)
      setLista(prev => prev.filter(i => i.id !== indicador.id))
      setDeleteModal({ open: false })
      addToast('ok', `Indicador "${indicador.nome}" excluído com sucesso.`)
    } catch (err) {
      const status   = err instanceof ApiError ? err.status : 0
      const rawMsg   = err instanceof Error   ? err.message : ''
      const isNetErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      if (import.meta.env.DEV && (status === 401 || status === 404 || isNetErr)) {
        setLista(prev => prev.filter(i => i.id !== indicador.id))
        setDeleteModal({ open: false })
        addToast('ok', `Indicador "${indicador.nome}" excluído com sucesso.`)
      } else {
        addToast('erro', `Erro ao excluir: ${rawMsg || 'tente novamente.'}`)
      }
    } finally {
      setDeletingId(null)
    }
  }, [deleteModal.indicador, del, addToast])

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
      onEdit:   (i) => setFormModal({ open: true, indicador: i }),
      onDelete: (i) => setDeleteModal({ open: true, indicador: i }),
    }),
    [filtrados, canWrite],
  )

  const ROW_HEIGHT = 52
  const listHeight = Math.min(filtrados.length * ROW_HEIGHT, 520)

  const hasFilters = busca || filtroTipo || filtroStatus

  // ── Stats cards ────────────────────────────────────────────────────────────
  const statsCards = [
    { label: 'Total',     value: lista.length,  valueClr: 'text-primary' },
    { label: 'Ativos',    value: totalAtivos,   valueClr: 'text-status-ok' },
    { label: 'Produção',  value: totalProducao, valueClr: 'text-primary' },
    { label: 'Qualidade', value: totalQualidade, valueClr: 'text-text-primary' },
  ]

  if (!unidadeId) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <BarChart3 size={48} className="text-text-faint" />
        <p className="text-text-secondary">Nenhuma unidade selecionada.</p>
        <button
          type="button"
          onClick={() => navigate('/unidades')}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <ArrowLeft size={16} />
          Voltar às Unidades
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
          {/* Botão voltar */}
          <button
            type="button"
            onClick={() => navigate('/unidades')}
            aria-label="Voltar às Unidades"
            className="mt-0.5 rounded-xl border border-border-subtle bg-surface p-2 text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Indicadores</h1>
              {unidadeLoading ? (
                <div className="h-4 w-48 animate-pulse rounded bg-surface-alt" />
              ) : (
                <p className="text-sm text-text-muted">
                  {unidade ? (
                    <>
                      <span className="font-medium text-text-secondary">{unidade.nome}</span>
                      {' · '}
                    </>
                  ) : null}
                  {loading
                    ? 'Carregando…'
                    : `${lista.length} indicador${lista.length !== 1 ? 'es' : ''} cadastrado${lista.length !== 1 ? 's' : ''}`
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
          {canWrite && (
            <button
              type="button"
              onClick={() => setFormModal({ open: true })}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Plus size={16} />
              Novo Indicador
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
            placeholder="Buscar por nome, descrição ou unidade de medida…"
            aria-label="Buscar indicadores"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text-secondary">
              <XIcon size={14} />
            </button>
          )}
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
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>

        {/* Pill resultados + limpar */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setBusca(''); setFiltroTipo(''); setFiltroStatus('') }}
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
                <div role="columnheader" className="font-medium text-white/70">Descrição</div>
                <div role="columnheader"><SortBtn col="tipo">Tipo</SortBtn></div>
                <div role="columnheader" className="text-right"><SortBtn col="metaPadrao">Meta</SortBtn></div>
                <div role="columnheader"><SortBtn col="unidadeMedida">Medida</SortBtn></div>
                <div role="columnheader"><SortBtn col="status">Status</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Ações</div>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div role="status" aria-label="Carregando indicadores">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
                  <BarChart3 size={28} />
                </div>
                <p className="font-medium text-text-secondary">
                  {hasFilters ? 'Nenhum indicador encontrado' : 'Nenhum indicador cadastrado'}
                </p>
                <p className="text-sm text-text-muted">
                  {hasFilters
                    ? 'Tente outros termos ou limpe os filtros.'
                    : canWrite
                      ? 'Clique em "Novo Indicador" para começar.'
                      : 'Entre em contato com o administrador.'}
                </p>
              </div>
            ) : (
              <div
                role="table"
                aria-label="Lista de Indicadores"
                aria-rowcount={filtrados.length + 1}
              >
                <div role="rowgroup">
                  <List
                    rowComponent={IndicadorRow}
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

        {/* Footer */}
        {!loading && filtrados.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
            <span>
              Exibindo <strong className="text-text-secondary">{filtrados.length}</strong> de{' '}
              <strong className="text-text-secondary">{lista.length}</strong> indicadores
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
        <IndicadoresFormModal
          indicador={formModal.indicador}
          unidadeId={unidadeId}
          onSalvo={handleSalvo}
          onFechar={() => setFormModal({ open: false })}
        />
      )}
      {deleteModal.open && deleteModal.indicador && (
        <IndicadoresDeleteModal
          indicador={deleteModal.indicador}
          loading={deletingId === deleteModal.indicador.id}
          onConfirmar={handleDeleteConfirm}
          onFechar={() => setDeleteModal({ open: false })}
        />
      )}
    </div>
  )
}
