import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { List, type RowComponentProps } from 'react-window'
import {
  Building2, Plus, Search, RefreshCw, Edit3, Trash2,
  CheckCircle, XCircle, ChevronUp, ChevronDown, ChevronsUpDown,
  X as XIcon,
} from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'
import type { OssRecord } from './types'
import { formatarCNPJ, unwrap, mockOssRecords } from './types'
import OssFormModal from './OssFormModal'
import OssDeleteModal from './OssDeleteModal'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast {
  id: number
  type: 'ok' | 'erro'
  msg: string
}

let toastId = 0

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 animate-pulse">
      {[180, 130, 160, 110, 160].map((w, i) => (
        <div key={i} className="h-3.5 rounded bg-surface-alt" style={{ width: w, flexShrink: 0 }} />
      ))}
      <div className="h-5 w-16 flex-shrink-0 rounded-full bg-surface-alt" />
      <div className="ml-auto flex gap-2">
        <div className="h-7 w-7 rounded-lg bg-surface-alt" />
        <div className="h-7 w-7 rounded-lg bg-surface-alt" />
      </div>
    </div>
  )
}

// ── Sort types ────────────────────────────────────────────────────────────────
type SortKey = 'nome' | 'cnpj' | 'email' | 'status'
type SortDir = 'asc' | 'desc'

// ── Column layout ─────────────────────────────────────────────────────────────
// Soma colunas fixas: 145+160+110+155+80+80 = 730px
// + gap-3 × 6 (72px) + px-4 (32px) = 834px fixos
// + nome minmax(160px, …) → mínimo total ≈ 994px
const COL      = 'grid-cols-[minmax(160px,2fr)_145px_160px_110px_155px_80px_80px]'
const MIN_W    = 1000   // largura mínima do scroll horizontal (px)

// ── Row props passed to react-window List ─────────────────────────────────────
interface RowProps {
  rows: OssRecord[]
  canUpdate: boolean
  canDelete: boolean
  onEdit: (oss: OssRecord) => void
  onDelete: (oss: OssRecord) => void
}

// ── Row component (react-window v2 API) ───────────────────────────────────────
function OssRow({
  ariaAttributes,
  index,
  style,
  rows,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: RowComponentProps<RowProps>) {
  const oss = rows[index]
  if (!oss) return null

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
        <p className="truncate font-medium text-text-primary" title={oss.nome}>
          {oss.nome}
        </p>
      </div>

      {/* CNPJ */}
      <div role="cell" className="whitespace-nowrap font-mono text-xs text-text-secondary">
        {formatarCNPJ(oss.cnpj)}
      </div>

      {/* Endereço */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-muted" title={oss.endereco ?? '—'}>
          {oss.endereco ?? '—'}
        </p>
      </div>

      {/* Telefone */}
      <div role="cell" className="whitespace-nowrap text-xs text-text-secondary">
        {oss.telefone ?? '—'}
      </div>

      {/* E-mail */}
      <div role="cell" className="min-w-0">
        <p className="truncate text-xs text-text-secondary" title={oss.email ?? ''}>
          {oss.email ?? '—'}
        </p>
      </div>

      {/* Status badge */}
      <div role="cell">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            oss.status === 'ativa'
              ? 'bg-status-ok-bg text-status-ok'
              : 'bg-status-bad-bg text-status-bad'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              oss.status === 'ativa' ? 'bg-status-ok' : 'bg-status-bad'
            }`}
            aria-hidden="true"
          />
          {oss.status === 'ativa' ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      {/* Ações */}
      <div role="cell" className="flex items-center gap-1">
        {canUpdate && (
          <button
            type="button"
            onClick={() => onEdit(oss)}
            aria-label={`Editar ${oss.nome}`}
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Edit3 size={15} />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(oss)}
            aria-label={`Excluir ${oss.nome}`}
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
export default function OssList() {
  const { get, request } = useApi()
  const { canInsert, canUpdate, canDelete } = usePermission('oss')

  // ── State ──────────────────────────────────────────────────────────────────
  const [lista, setLista] = useState<OssRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativa' | 'inativa'>('todas')
  const [sortKey, setSortKey] = useState<SortKey>('nome')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [toasts, setToasts] = useState<Toast[]>([])

  const [formModal, setFormModal]     = useState<{ open: boolean; oss?: OssRecord }>({ open: false })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; oss?: OssRecord }>({ open: false })

  const buscaRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(MIN_W)

  // Mede a largura do container interno (respeita minWidth)
  useEffect(() => {
    if (!tableRef.current) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setTableWidth(w)
    })
    obs.observe(tableRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLista = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<OssRecord[] | { data: OssRecord[] }>('/oss')
      setLista(unwrap(res))
    } catch {
      if (import.meta.env.DEV) setLista(mockOssRecords)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { fetchLista() }, [fetchLista])

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast['type'], msg: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let result = lista

    if (filtroStatus !== 'todas')
      result = result.filter(o => o.status === filtroStatus)

    if (busca.trim()) {
      const term = busca.toLowerCase()
      result = result.filter(o =>
        o.nome.toLowerCase().includes(term) ||
        o.cnpj.replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
        (o.email ?? '').toLowerCase().includes(term) ||
        (o.endereco ?? '').toLowerCase().includes(term),
      )
    }

    return [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'nome':   cmp = a.nome.localeCompare(b.nome, 'pt-BR'); break
        case 'cnpj':   cmp = a.cnpj.localeCompare(b.cnpj); break
        case 'email':  cmp = (a.email ?? '').localeCompare(b.email ?? ''); break
        case 'status': cmp = a.status.localeCompare(b.status); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [lista, busca, filtroStatus, sortKey, sortDir])

  const totalAtivas   = lista.filter(o => o.status === 'ativa').length
  const totalInativas = lista.filter(o => o.status === 'inativa').length

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSalvo = useCallback(
    (salvo: OssRecord) => {
      const isEdit = Boolean(formModal.oss)
      setLista(prev => {
        const idx = prev.findIndex(o => o.id === salvo.id)
        return idx >= 0 ? prev.map(o => (o.id === salvo.id ? salvo : o)) : [...prev, salvo]
      })
      setFormModal({ open: false })
      addToast('ok', isEdit ? 'Organização atualizada!' : 'Organização criada com sucesso!')
    },
    [formModal.oss, addToast],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.oss) return
    const { oss } = deleteModal
    setDeletingId(oss.id)
    try {
      await request(`/oss/${oss.id}`, { method: 'DELETE' })
      setLista(prev => prev.filter(o => o.id !== oss.id))
      setDeleteModal({ open: false })
      addToast('ok', `${oss.nome} excluída com sucesso.`)
    } catch (err) {
      addToast('erro', err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }, [deleteModal, request, addToast])

  // ── Sort button ───────────────────────────────────────────────────────────
  function SortBtn({ col, children }: { col: SortKey; children: React.ReactNode }) {
    return (
      <button
        type="button"
        onClick={() => handleSort(col)}
        className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-white/80 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded"
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

  // ── Row props for react-window v2 ─────────────────────────────────────────
  const rowProps: RowProps = useMemo(
    () => ({
      rows: filtrados,
      canUpdate,
      canDelete,
      onEdit: (oss) => setFormModal({ open: true, oss }),
      onDelete: (oss) => setDeleteModal({ open: true, oss }),
    }),
    [filtrados, canUpdate, canDelete],
  )

  const ROW_HEIGHT = 52
  const listHeight = Math.min(filtrados.length * ROW_HEIGHT, 520)

  return (
    <div className="flex h-full flex-col gap-5">
      {/* ── Toasts ── */}
      <div
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
        aria-live="polite"
        aria-label="Notificações"
      >
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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Organizações Sociais</h1>
            <p className="text-sm text-text-muted">
              {loading
                ? 'Carregando…'
                : `${lista.length} organização${lista.length !== 1 ? 'ões' : ''} cadastrada${lista.length !== 1 ? 's' : ''}`}
            </p>
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
              Nova OSS
            </button>
          )}
        </div>
      </div>

      {/* ── Stats cards ── */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Total',    value: lista.length,  clr: 'bg-primary/10 text-primary',       bdr: 'border-primary/20'           },
            { label: 'Ativas',   value: totalAtivas,   clr: 'bg-status-ok-bg text-status-ok',   bdr: 'border-status-ok-border'    },
            { label: 'Inativas', value: totalInativas, clr: 'bg-status-bad-bg text-status-bad', bdr: 'border-status-bad-border'   },
          ].map(c => (
            <div key={c.label} className={`flex items-center gap-3 rounded-xl border bg-surface-alt p-4 shadow-sm ${c.bdr}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${c.clr}`}>
                {c.value}
              </div>
              <p className="text-sm font-medium text-text-secondary">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ, e-mail…"
            aria-label="Buscar organizações"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-faint hover:text-text-secondary"
            >
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
          <option value="todas">Todas as OSS</option>
          <option value="ativa">Somente ativas</option>
          <option value="inativa">Somente inativas</option>
        </select>
        {(busca || filtroStatus !== 'todas') && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xl">

        {/* ── Scroll horizontal — header + body rolam juntos ── */}
        <div className="min-h-0 flex-1 overflow-x-auto">
          {/* Container com largura mínima: ResizeObserver mede aqui */}
          <div
            ref={tableRef}
            style={{ minWidth: MIN_W }}
            className="flex flex-col"
          >
            {/* Header */}
            <div role="rowgroup" className="shrink-0 border-b border-border-subtle bg-primary text-white">
              <div role="row" aria-rowindex={1} className={`grid ${COL} items-center gap-3 px-4 py-3 text-xs`}>
                <div role="columnheader"><SortBtn col="nome">Nome</SortBtn></div>
                <div role="columnheader"><SortBtn col="cnpj">CNPJ</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Endereço</div>
                <div role="columnheader" className="font-medium text-white/70">Telefone</div>
                <div role="columnheader"><SortBtn col="email">E-mail</SortBtn></div>
                <div role="columnheader"><SortBtn col="status">Status</SortBtn></div>
                <div role="columnheader" className="font-medium text-white/70">Ações</div>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div role="status" aria-label="Carregando organizações">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-faint">
                  <Building2 size={28} />
                </div>
                <p className="font-medium text-text-secondary">
                  {busca || filtroStatus !== 'todas' ? 'Nenhuma organização encontrada' : 'Nenhuma organização cadastrada'}
                </p>
                <p className="text-sm text-text-muted">
                  {busca || filtroStatus !== 'todas'
                    ? 'Tente outros termos ou limpe os filtros.'
                    : canInsert ? 'Clique em "Nova OSS" para começar.' : 'Entre em contato com o administrador.'}
                </p>
              </div>
            ) : (
              <div
                role="table"
                aria-label="Lista de Organizações Sociais"
                aria-rowcount={filtrados.length + 1}
              >
                <div role="rowgroup">
                  <List
                    rowComponent={OssRow}
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
          <div className="shrink-0 flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-xs text-text-muted">
            <span>
              Exibindo <strong className="text-text-secondary">{filtrados.length}</strong> de{' '}
              <strong className="text-text-secondary">{lista.length}</strong> organizações
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
        <OssFormModal
          oss={formModal.oss}
          onSalvo={handleSalvo}
          onFechar={() => setFormModal({ open: false })}
        />
      )}
      {deleteModal.open && deleteModal.oss && (
        <OssDeleteModal
          oss={deleteModal.oss}
          loading={deletingId === deleteModal.oss.id}
          onConfirmar={handleDeleteConfirm}
          onFechar={() => setDeleteModal({ open: false })}
        />
      )}
    </div>
  )
}
