import { useEffect } from 'react'
import { UserX, X, Loader2, AlertTriangle } from 'lucide-react'
import type { Usuario } from '../../types'
import { PERFIL_LABELS } from './types'

interface Props {
  usuario: Usuario
  loading: boolean
  onConfirmar: () => void
  onFechar: () => void
}

export default function UsuariosDeleteModal({ usuario, loading, onConfirmar, onFechar }: Props) {
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
      aria-labelledby="usuario-delete-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              <UserX size={20} />
            </div>
            <h2 id="usuario-delete-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Desativar usuário
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              O usuário será <strong className="text-slate-900 dark:text-white">desativado</strong> e não poderá mais acessar o sistema.
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Usuário
            </p>
            <p className="font-semibold text-slate-900 dark:text-white">{usuario.nome}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{usuario.email}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Perfil: {PERFIL_LABELS[usuario.perfil] ?? usuario.perfil}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onFechar}
            disabled={loading}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-slate-800"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <UserX size={16} />
            )}
            Desativar
          </button>
        </div>
      </div>
    </div>
  )
}
