import { useEffect } from 'react'
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import type { UnidadeRecord } from './types'
import { TIPO_LABELS, STATUS_LABELS, STATUS_BADGE } from './types'

interface Props {
  unidade: UnidadeRecord
  loading: boolean
  onConfirmar: () => void
  onFechar: () => void
}

export default function UnidadesDeleteModal({ unidade, loading, onConfirmar, onFechar }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
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
      aria-labelledby="delete-unidade-title"
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
            <h2 id="delete-unidade-title" className="text-base font-semibold text-text-primary">
              Excluir Unidade de Saúde
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
        <div className="space-y-4 px-6 py-5">
          <div className="flex gap-3 rounded-xl border border-status-warn-border bg-status-warn-bg p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-status-warn" />
            <p className="text-sm text-text-secondary">
              Esta ação é <strong className="text-text-primary">irreversível</strong>.
              Indicadores e metas vinculados a esta unidade podem ser afetados.
            </p>
          </div>

          {/* Resumo da unidade */}
          <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-alt p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Unidade a ser excluída
            </p>
            <p className="text-base font-bold text-text-primary">{unidade.nome}</p>
            {unidade.contrato && (
              <p className="text-sm font-medium text-text-secondary">
                Contrato {unidade.contrato.numeroContrato}
                {unidade.contrato.oss && ` — ${unidade.contrato.oss.nome}`}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-medium border border-border-subtle text-text-secondary">
                {TIPO_LABELS[unidade.tipo]}
              </span>
              <span className="text-sm text-text-muted">
                Capacidade: <strong className="text-text-secondary">{unidade.capacidade}</strong>
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[unidade.status]}`}
              >
                {STATUS_LABELS[unidade.status]}
              </span>
            </div>
            <p className="text-xs text-text-muted truncate">{unidade.endereco}</p>
          </div>

          <p className="text-sm text-text-muted">
            Deseja confirmar a exclusão permanente de{' '}
            <strong className="text-text-primary">{unidade.nome}</strong>?
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
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  )
}
