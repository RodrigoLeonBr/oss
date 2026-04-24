import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import type { Perfil, PermissaoPerfil } from '../../types'
import { PERFIS_LIST, PERFIL_LABELS, MODULOS_LIST, MODULO_LABELS } from './types'
import { useApi } from '../../hooks/useApi'

interface RowState {
  modulo: string
  can_view: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
  escopo: 'global' | 'proprio'
}

function buildEmptyRows(): RowState[] {
  return MODULOS_LIST.map(m => ({
    modulo: m,
    can_view: false,
    can_insert: false,
    can_update: false,
    can_delete: false,
    escopo: 'global',
  }))
}

function mergePermissoes(rows: RowState[], perms: PermissaoPerfil[]): RowState[] {
  return rows.map(r => {
    const p = perms.find(x => x.modulo === r.modulo)
    if (!p) return r
    return {
      modulo:     p.modulo,
      can_view:   Boolean(p.can_view),
      can_insert: Boolean(p.can_insert),
      can_update: Boolean(p.can_update),
      can_delete: Boolean(p.can_delete),
      escopo:     p.escopo,
    }
  })
}

export default function PermissoesMatrix() {
  const { get, put } = useApi()
  const [perfil, setPerfil] = useState<Perfil>('admin')
  const [rows, setRows] = useState<RowState[]>(buildEmptyRows())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = useCallback(async (p: Perfil) => {
    setLoading(true)
    setFeedback(null)
    try {
      const res = await get<{ data: PermissaoPerfil[] }>(`/permissoes/${p}`)
      setRows(mergePermissoes(buildEmptyRows(), res.data ?? []))
    } catch {
      setRows(buildEmptyRows())
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => { void load(perfil) }, [perfil, load])

  const toggle = (modulo: string, field: keyof Omit<RowState, 'modulo' | 'escopo'>) => {
    setRows(prev => prev.map(r => (r.modulo === modulo ? { ...r, [field]: !r[field] } : r)))
  }

  const setEscopo = (modulo: string, v: 'global' | 'proprio') => {
    setRows(prev => prev.map(r => (r.modulo === modulo ? { ...r, escopo: v } : r)))
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      await put(`/permissoes/${perfil}`, { permissoes: rows })
      setFeedback({ type: 'success', msg: 'Permissões salvas com sucesso.' })
    } catch (e) {
      setFeedback({ type: 'error', msg: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  const Chk = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Permissões por Perfil</h1>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>

      {feedback && (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          feedback.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {feedback.msg}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Perfil:</span>
        <select
          value={perfil}
          onChange={e => setPerfil(e.target.value as Perfil)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          {PERFIS_LIST.map(p => (
            <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="w-48 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Módulo
              </th>
              {['Visualizar', 'Inserir', 'Alterar', 'Excluir'].map(h => (
                <th key={h} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Escopo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.modulo} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {MODULO_LABELS[row.modulo] ?? row.modulo}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_view}   onChange={() => toggle(row.modulo, 'can_view')} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_insert} onChange={() => toggle(row.modulo, 'can_insert')} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_update} onChange={() => toggle(row.modulo, 'can_update')} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Chk checked={row.can_delete} onChange={() => toggle(row.modulo, 'can_delete')} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.escopo}
                      onChange={e => setEscopo(row.modulo, e.target.value as 'global' | 'proprio')}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="global">Global</option>
                      <option value="proprio">Próprio</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
