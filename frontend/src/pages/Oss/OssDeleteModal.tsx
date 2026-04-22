import { useEffect } from 'react'
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import type { OssRecord } from './types'
import { formatarCNPJ } from './types'

interface Props {
  oss: OssRecord
  loading: boolean
  onConfirmar: () => void
  onFechar: () => void
}

export default function OssDeleteModal({ oss, loading, onConfirmar, onFechar }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onFechar])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-bad-bg text-status-bad">
              <Trash2 size={20} />
            </div>
            <h2 id="delete-modal-title" className="text-base font-semibold text-text-primary">
              Excluir Organização Social
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            disabled={loading}
            className="rounded-lg p-1.5 text-text-faint transition-colors hover:bg-hover hover:text-text-secondary disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">
          {/* Warning banner */}
          <div className="flex gap-3 rounded-xl border border-status-warn-border bg-status-warn-bg p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-status-warn" />
            <p className="text-sm text-text-secondary">
              Esta ação é <strong className="text-text-primary">irreversível</strong>. Contratos,
              unidades e indicadores vinculados podem ser afetados.
            </p>
          </div>

          {/* OSS summary card */}
          <div className="rounded-xl border border-border-subtle bg-surface-alt p-4 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Organização a ser excluída
            </p>
            <p className="font-semibold text-text-primary">{oss.nome}</p>
            <p className="font-mono text-sm text-text-secondary">{formatarCNPJ(oss.cnpj)}</p>
            {oss.email && (
              <p className="text-sm text-text-muted">{oss.email}</p>
            )}
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

          <p className="text-sm text-text-muted">
            Deseja confirmar a exclusão permanente de{' '}
            <strong className="text-text-primary">{oss.nome}</strong>?
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 border-t border-border-subtle px-6 py-4">
          <button
            type="button"
            onClick={onFechar}
            disabled={loading}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-status-bad px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:ring-2 focus:ring-status-bad focus:ring-offset-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  )
}
