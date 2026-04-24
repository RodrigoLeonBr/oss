import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, UserX, RefreshCw } from 'lucide-react'
import type { Perfil, Usuario } from '../../types'
import { PERFIL_LABELS } from './types'
import UsuariosFormModal from './UsuariosFormModal'
import UsuariosDeleteModal from './UsuariosDeleteModal'
import { useApi } from '../../hooks/useApi'
import { usePermission } from '../../hooks/usePermission'

export default function UsuariosList() {
  const { get, del } = useApi()
  const { canInsert, canUpdate, canDelete } = usePermission('usuarios')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editTarget, setEditTarget] = useState<Usuario | null | undefined>(undefined)
  const [deactivateTarget, setDeactivateTarget] = useState<Usuario | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get<{ data: Usuario[] }>('/usuarios')
      setUsuarios(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { void load() }, [load])

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return
    setDeactivateLoading(true)
    try {
      await del(`/usuarios/${deactivateTarget.usuario_id}`)
      setDeactivateTarget(null)
      void load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao desativar.')
    } finally {
      setDeactivateLoading(false)
    }
  }

  const perfilBadge = (perfil: Perfil) => (
    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      {PERFIL_LABELS[perfil] ?? perfil}
    </span>
  )

  const ativoBadge = (ativo: boolean | number) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      ativo
        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Usuários</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} />
          </button>
          {canInsert && (
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Plus size={16} />
              Novo Usuário
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {['Nome', 'E-mail', 'Perfil', 'OSS', 'Status', 'Último Acesso', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/50">
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">Carregando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">Nenhum usuário encontrado.</td></tr>
            ) : (
              usuarios.map(u => (
                <tr key={u.usuario_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{u.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">{perfilBadge(u.perfil)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {u.organizacao?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3">{ativoBadge(u.ativo)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => setEditTarget(u)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && u.ativo && (
                        <button
                          type="button"
                          onClick={() => setDeactivateTarget(u)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Desativar"
                        >
                          <UserX size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editTarget !== undefined && (
        <UsuariosFormModal
          usuario={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSaved={() => { setEditTarget(undefined); void load() }}
        />
      )}

      {deactivateTarget && (
        <UsuariosDeleteModal
          usuario={deactivateTarget}
          loading={deactivateLoading}
          onFechar={() => !deactivateLoading && setDeactivateTarget(null)}
          onConfirmar={() => void handleConfirmDeactivate()}
        />
      )}
    </div>
  )
}
