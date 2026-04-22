import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { List, type RowComponentProps } from 'react-window'
import {
  FileText, Plus, Search, RefreshCw, Edit3, Trash2,
  CheckCircle, XCircle, ChevronUp, ChevronDown, ChevronsUpDown,
  X as XIcon, Filter,
} from 'lucide-react'
import { useApi, ApiError } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'
import type { ContratoRecord } from './types'
import {
  formatarMoeda, formatarData, formatarPercentual,
  STATUS_LABELS, STATUS_BADGE, STATUS_DOT,
  unwrap,
} from './types'
import type { OssRecord } from '../Oss/types'
import { formatarCNPJ } from '../Oss/types'
import ContratosFormModal from './ContratosFormModal'
import ContratosDeleteModal from './ContratosDeleteModal'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'ok' | 'erro'; msg: string }
let toastId = 0

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-border-subtle px-4 py-3">
      {[130, 180, 150, 110, 75, 90].map((w, i) => (
        <div key={i} className="h-3.5 rounded bg-surface-alt" style={{ width: w, flexShrink: 0 }} />
      ))}
      <div className="h-5 w-20 shrink-0 rounded-full bg-surface-alt" />
      <div className="ml-auto flex gap-2">
        <div className="h-7 w-7 rounded-lg bg-surface-alt" />
        <div className="h-7 w-7 rounded-lg bg-surface-alt" />
      </div>
    </div>
  )
}

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortKey = 'numeroContrato' | 'ossNome' | 'periodoInicio' | 'valorMensal' | 'status'
type SortDir = 'asc' | 'desc'

// ── Column layout ─────────────────────────────────────────────────────────────
// Colunas fixas: 140+170+130+95+100+76 = 711px
// + gap-3×6(72px) + px-4×2(32px) = 815px de fixo
// + nome minmax(160px,…) → mínimo total ≈ 975px
const COL   = 'grid-cols-[140px_minmax(160px,2fr)_170px_130px_95px_100px_76px]'
const MIN_W = 980

// ── Row props ─────────────────────────────────────────────────────────────────
interface RowProps {
  rows: ContratoRecord[]
  canWrite: boolean
  onEdit: (c: ContratoRecord) => void
  onDelete: (c: ContratoRecord) => void
}

// ── Row component (react-window v2 API) ───────────────────────────────────────
function ContratoRow({
  ariaAttributes,
  index,
  style,
  rows,
  canWrite,
  onEdit,
  onDelete,
}: RowComponentProps<RowProps>) {
  const c = rows[index]
  if (!c) return null

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
      {/* Nº Contrato */}
      <div role="cell" className="min-w-0">
        <p className="truncate font-mono text-xs font-bold text-text-primary" title={c.numeroContrato}>
          {c.numeroContrato}
        </p>
      </div>

      {/* OSS */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs font-medium text-text-primary" title={c.oss?.nome ?? c.ossId}>
          {c.oss?.nome ?? c.ossId}
        </p>
        {c.oss?.cnpj && (
          <p className="truncate font-mono text-[10px] text-text-muted">{formatarCNPJ(c.oss.cnpj)}</p>
        )}
      </div>

      {/* Período */}
      <div role="cell" className="min-w-0">
        <p className="whitespace-nowrap text-xs text-text-secondary">{formatarData(c.periodoInicio)}</p>
        <p className="whitespace-nowrap text-[10px] text-text-muted">até {formatarData(c.periodoFim)}</p>
      </div>

      {/* Valor Mensal */}
      <div role="cell" className="whitespace-nowrap text-xs font-semibold text-text-primary">
        {formatarMoeda(c.valorMensal)}
      </div>

      {/* % Desconto */}
      <div role="cell" className="whitespace-nowrap text-xs text-text-secondary">
        {formatarPercentual(c.percentualDesconto)}
      </div>

      {/* Status */}
      <div role="cell">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[c.status]}`} aria-hidden="true" />
          {STATUS_LABELS[c.status]}
        </span>
      </div>

      {/* Ações */}
      <div role="cell" className="flex items-center gap-1">
        {canWrite && (
          <>
            <button
              type="button"
              onClick={() => onEdit(c)}
              aria-label={`Editar contrato ${c.numeroContrato}`}
              className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Edit3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(c)}
              aria-label={`Excluir contrato ${c.numeroContrato}`}
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
export default function ContratosList() {
  const { get, del } = useApi()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(['admin', 'gestor_sms'])

  // ── State ──────────────────────────────────────────────────────────────────
  const [lista, setLista]               = useState<ContratoRecord[]>([])
  const [loading, setLoading]           = useState(true)
  const [ossList, setOssList]           = useState<OssRecord[]>([])
  const [ossLoading, setOssLoading]     = useState(true)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [busca, setBusca]               = useState('')
  const [filtroOss, setFiltroOss]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | 'ativo' | 'encerrado' | 'suspenso'>('')
  const [sortKey, setSortKey]           = useState<SortKey>('numeroContrato')
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [toasts, setToasts]             = useState<Toast[]>([])

  const [formModal, setFormModal]     = useState<{ open: boolean; contrato?: ContratoRecord }>({ open: false })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; contrato?: ContratoRecord }>({ open: false })

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

  // ── Fetch contratos ────────────────────────────────────────────────────────
  const fetchLista = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<ContratoRecord[] | { data: ContratoRecord[] }>('/contratos')
      setLista(unwrap(res))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível carregar os contratos.'
      setLista([])
      addToast('erro', msg)
    } finally {
      setLoading(false)
    }
  }, [get, addToast])

  // ── Fetch OSS (dropdown de filtro e formulário) ────────────────────────────
  const fetchOss = useCallback(async () => {
    setOssLoading(true)
    try {
      const res = await get<OssRecord[] | { data: OssRecord[] }>('/oss')
      setOssList(unwrap(res))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível carregar as OSS.'
      setOssList([])
      addToast('erro', msg)
    } finally {
      setOssLoading(false)
    }
  }, [get, addToast])

  useEffect(() => {
    fetchLista()
    fetchOss()
  }, [fetchLista, fetchOss])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalAtivos    = useMemo(() => lista.filter(c => c.status === 'ativo').length,    [lista])
  const totalSuspensos = useMemo(() => lista.filter(c => c.status === 'suspenso').length, [lista])
  const valorTotal     = useMemo(
    () => lista.filter(c => c.status === 'ativo').reduce((s, c) => s + c.valorMensal, 0),
    [lista],
  )

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let items = [...lista]

    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(c =>
        c.numeroContrato.toLowerCase().includes(q) ||
        (c.oss?.nome ?? '').toLowerCase().includes(q),
      )
    }
    if (filtroOss)    items = items.filter(c => c.ossId === filtroOss)
    if (filtroStatus) items = items.filter(c => c.status === filtroStatus)

    items.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'numeroContrato': va = a.numeroContrato;     vb = b.numeroContrato;     break
        case 'ossNome':        va = a.oss?.nome ?? '';    vb = b.oss?.nome ?? '';    break
        case 'periodoInicio':  va = a.periodoInicio;      vb = b.periodoInicio;      break
        case 'valorMensal':    va = a.valorMensal;        vb = b.valorMensal;        break
        case 'status':         va = a.status;             vb = b.status;             break
        default: return 0
      }
      const cmp = typeof va === 'number'
        ? va - (vb as number)
        : String(va).localeCompare(String(vb), 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [lista, busca, filtroOss, filtroStatus, sortKey, sortDir])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSort(col: SortKey) {
    setSortDir(prev => sortKey === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setSortKey(col)
  }

  const handleSalvo = useCallback((contrato: ContratoRecord) => {
    setLista(prev => {
      const idx = prev.findIndex(c => c.id === contrato.id)
      return idx >= 0
        ? prev.map(c => c.id === contrato.id ? contrato : c)
        : [contrato, ...prev]
    })
    setFormModal({ open: false })
    addToast('ok', `Contrato ${contrato.numeroContrato} salvo com sucesso.`)
  }, [addToast])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.contrato) return
    const contrato = deleteModal.contrato
    setDeletingId(contrato.id)
    try {
      await del(`/contratos/${contrato.id}`)
      setLista(prev => prev.filter(c => c.id !== contrato.id))
      setDeleteModal({ open: false })
      addToast('ok', `Contrato ${contrato.numeroContrato} excluído com sucesso.`)
    } catch (err) {
      const status  = err instanceof ApiError ? err.status : 0
      const rawMsg  = err instanceof Error ? err.message : ''
      const isNetErr = rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')

      if (status === 409) {
        addToast('erro', rawMsg || 'Não é possível excluir este contrato.')
      } else if (isNetErr) {
        addToast('erro', 'Não foi possível conectar ao servidor.')
      } else {
        addToast('erro', `Erro ao excluir: ${rawMsg || 'tente novamente.'}`)
      }
    } finally {
      setDeletingId(null)
    }
  }, [deleteModal.contrato, del, addToast])

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
      onEdit:   (c) => setFormModal({ open: true, contrato: c }),
      onDelete: (c) => setDeleteModal({ open: true, contrato: c }),
    }),
    [filtrados, canWrite],
  )

  const ROW_HEIGHT = 56
  const listHeight = Math.min(filtrados.length * ROW_HEIGHT, 560)

  const hasFilters = busca || filtroOss || filtroStatus

  // ── Stats cards data ───────────────────────────────────────────────────────
  const statsCards: { label: string; value: string | number; valueClr: string; mono?: boolean }[] = [
    { label: 'Total',                 value: lista.length,              valueClr: 'text-primary' },
    { label: 'Ativos',                value: totalAtivos,               valueClr: 'text-status-ok' },
    { label: 'Suspensos',             value: totalSuspensos,            valueClr: 'text-status-bad' },
    { label: 'Valor Mensal (ativos)', value: formatarMoeda(valorTotal), valueClr: 'text-primary', mono: true },
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
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Contratos de Gestão</h1>
            <p className="text-sm text-text-muted">
              {loading
                ? 'Carregando…'
                : `${lista.length} contrato${lista.length !== 1 ? 's' : ''} cadastrado${lista.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { fetchLista(); fetchOss() }}
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
              Novo Contrato
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
        {/* Busca */}
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nº contrato ou OSS…"
            aria-label="Buscar contratos"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text-secondary">
              <XIcon size={14} />
            </button>
          )}
        </div>

        {/* OSS filter */}
        <div className="relative flex items-center">
          <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <select
            value={filtroOss}
            onChange={e => setFiltroOss(e.target.value)}
            aria-label="Filtrar por OSS"
            className="appearance-none rounded-xl border border-border-subtle bg-surface py-2 pl-8 pr-6 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Todas as OSS</option>
            {ossList.map(o => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
          aria-label="Filtrar por status"
          className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="encerrado">Encerrado</option>
          <option value="suspenso">Suspenso</option>
        </select>

        {/* Pill de resultados + limpar */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setBusca(''); setFiltroOss(''); setFiltroStatus('') }}
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
                <div role="columnheader"><SortBtn col="numeroContrato">Nº Contrato</SortBtn></div>
                <div role="columnheader"><SortBtn col="ossNome">OSS</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Período</div>
                <div role="columnheader"><SortBtn col="valorMensal">Valor Mensal</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">% Desc.</div>
                <div role="columnheader"><SortBtn col="status">Status</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Ações</div>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div role="status" aria-label="Carregando contratos">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
                  <FileText size={28} />
                </div>
                <p className="font-medium text-text-secondary">
                  {hasFilters ? 'Nenhum contrato encontrado' : 'Nenhum contrato cadastrado'}
                </p>
                <p className="text-sm text-text-muted">
                  {hasFilters
                    ? 'Tente outros termos ou limpe os filtros.'
                    : canWrite
                      ? 'Clique em "Novo Contrato" para começar.'
                      : 'Entre em contato com o administrador.'}
                </p>
              </div>
            ) : (
              <div
                role="table"
                aria-label="Lista de Contratos de Gestão"
                aria-rowcount={filtrados.length + 1}
              >
                <div role="rowgroup">
                  <List
                    rowComponent={ContratoRow}
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
              <strong className="text-text-secondary">{lista.length}</strong> contratos
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
        <ContratosFormModal
          contrato={formModal.contrato}
          ossList={ossList}
          ossLoading={ossLoading}
          onSalvo={handleSalvo}
          onFechar={() => setFormModal({ open: false })}
        />
      )}
      {deleteModal.open && deleteModal.contrato && (
        <ContratosDeleteModal
          contrato={deleteModal.contrato}
          loading={deletingId === deleteModal.contrato.id}
          onConfirmar={handleDeleteConfirm}
          onFechar={() => setDeleteModal({ open: false })}
        />
      )}
    </div>
  )
}
