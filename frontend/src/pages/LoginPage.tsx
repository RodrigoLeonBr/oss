import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated && user) {
    const dest = (user.perfil === 'contratada_scmc' || user.perfil === 'contratada_indsh') ? '/perfil-oss' : user.perfil === 'conselheiro_cms' ? '/relatorios' : '/dashboard'
    navigate(dest, { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-blue-500 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Heart size={32} className="text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">OSS Saúde Americana</h1>
          <p className="mt-1 text-sm text-blue-200">
            Sistema de Acompanhamento de Contratos de Gestão
          </p>
        </div>

        <div className="rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm dark:bg-surface-dark/95">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Entrar no Sistema
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Utilize suas credenciais institucionais
          </p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-nao-cumprido/10 px-3 py-2 text-sm text-nao-cumprido" role="alert">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
                placeholder="seu.email@saude.americana.sp.gov.br"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-slate-900 dark:text-slate-200"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
              Contas de demonstração (MVP):
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-blue-700 dark:text-blue-400">
              <li><strong>Admin:</strong> admin@americana.sp.gov.br</li>
              <li><strong>Gestor SMS:</strong> gestor@sms.americana.sp.gov.br</li>
              <li><strong>Auditora:</strong> auditora@sms.americana.sp.gov.br</li>
              <li><strong>CMS:</strong> cms@americana.sp.gov.br</li>
              <li><strong>Contratada SCMC:</strong> operador@scmc.org.br</li>
              <li><strong>Contratada INDSH:</strong> operador@indsh.org.br</li>
            </ul>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-500">
              Qualquer senha funciona no modo MVP
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-blue-200">
          Secretaria Municipal de Saúde — Americana/SP
        </p>
      </div>
    </div>
  )
}
