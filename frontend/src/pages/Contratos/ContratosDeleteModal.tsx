import { useEffect } from 'react'
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import type { ContratoRecord } from './types'
import { formatarMoeda, formatarData, STATUS_LABELS, STATUS_BADGE } from './types'

interface Props {
  contrato: ContratoRecord
  loading: boolean
  onConfirmar: () => void
  onFechar: () => void
}

export default function ContratosDeleteModal({ contrato, loading, onConfirmar, onFechar }: Props) {
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
      aria-labelledby="delete-contrato-title"
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
            <h2 id="delete-contrato-title" className="text-base font-semibold text-text-primary">
              Excluir Contrato de Gestão
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
              Indicadores e metas vinculados a este contrato podem ser afetados.
            </p>
          </div>

          {/* Resumo do contrato */}
          <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-alt p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Contrato a ser excluído
            </p>
            <p className="font-mono text-base font-bold text-text-primary">
              {contrato.numeroContrato}
            </p>
            {contrato.oss && (
              <p className="text-sm font-medium text-text-secondary">{contrato.oss.nome}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
              <span>
                {formatarData(contrato.periodoInicio)} — {formatarData(contrato.periodoFim)}
              </span>
              <span className="font-semibold text-text-secondary">
                {formatarMoeda(contrato.valorMensal)}/mês
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[contrato.status]}`}
            >
              {STATUS_LABELS[contrato.status]}
            </span>
          </div>

          <p className="text-sm text-text-muted">
            Deseja confirmar a exclusão permanente do contrato{' '}
            <strong className="text-text-primary">{contrato.numeroContrato}</strong>?
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
