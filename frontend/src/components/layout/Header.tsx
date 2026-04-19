import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, LogOut, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard Executivo',
  '/entrada-mensal': 'Entrada Mensal',
  '/aprovacao': 'Aprovação Auditoria',
  '/relatorios': 'Relatórios CMS',
  '/perfil-oss': 'Perfil OSS',
}

export default function Header() {
  const { user, logout, darkMode, toggleDarkMode } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const pageTitle = pageTitles[location.pathname] || 'OSS Saúde'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          {pageTitle}
        </h1>
        <p className="text-xs text-text-muted">
          Sistema de Acompanhamento de Contratos de Gestão
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 text-text-muted hover:bg-hover"
          aria-label={darkMode ? 'Modo claro' : 'Modo escuro'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={16} />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-text-secondary">
                {user.nome}
              </p>
              <p className="text-xs text-text-muted">{user.perfil.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 rounded-lg p-2 text-text-muted hover:bg-status-bad-bg hover:text-status-bad"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
