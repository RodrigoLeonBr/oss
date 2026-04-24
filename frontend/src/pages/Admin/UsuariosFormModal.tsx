import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Perfil, Usuario, Oss } from '../../types'
import type { UsuarioFormData } from './types'
import { PERFIS_LIST, PERFIL_LABELS } from './types'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  usuario: Usuario | null
  onClose: () => void
  onSaved: () => void
}

const PRIVILEGIADOS: Perfil[] = ['admin', 'gestor_sms']

export default function UsuariosFormModal({ usuario, onClose, onSaved }: Props) {
  const { post, put, get } = useApi()
  const { user: currentUser } = useAuth()
  const isEdit = usuario !== null

  const [form, setForm] = useState<UsuarioFormData>({
    nome:     usuario?.nome     ?? '',
    email:    usuario?.email    ?? '',
    perfil:   usuario?.perfil   ?? 'visualizador',
    oss_id:   usuario?.oss_id   ?? '',
    telefone: usuario?.telefone ?? '',
    senha:    '',
    ativo:    usuario?.ativo    ?? true,
  })
  const [oss, setOss] = useState<Oss[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    get<{ data: Oss[] }>('/oss').then(r => setOss(r.data ?? [])).catch(() => {})
  }, [get])

  const perfisDispo = PERFIS_LIST.filter(p =>
    currentUser?.perfil === 'admin' ? true : !PRIVILEGIADOS.includes(p),
  )

  const needsOss = ['contratada_scmc', 'contratada_indsh'].includes(form.perfil)

  const set = (k: keyof UsuarioFormData, v: unknown) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isEdit && !form.senha) { setError('Senha obrigatória para novo usuário.'); return }
    if (needsOss && !form.oss_id) { setError('OSS obrigatória para perfil contratada.'); return }
    setLoading(true)
    try {
      const payload = { ...form, oss_id: form.oss_id || undefined }
      if (isEdit) {
        await put(`/usuarios/${usuario!.usuario_id}`, payload)
      } else {
        await post('/usuarios', payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Nome *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={e => set('nome', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">E-mail *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Perfil *</label>
              <select
                value={form.perfil}
                onChange={e => set('perfil', e.target.value as Perfil)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                {perfisDispo.map(p => (
                  <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Telefone</label>
              <input
                type="text"
                value={form.telefone}
                onChange={e => set('telefone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {needsOss && (
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">OSS vinculada *</label>
                <select
                  value={form.oss_id}
                  onChange={e => set('oss_id', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {oss.map(o => (
                    <option key={o.oss_id} value={o.oss_id}>{o.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {isEdit ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha *'}
              </label>
              <input
                type="password"
                value={form.senha}
                onChange={e => set('senha', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {isEdit && (
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={e => set('ativo', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary"
                />
                <label htmlFor="ativo" className="text-sm text-slate-700 dark:text-slate-300">Usuário ativo</label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
