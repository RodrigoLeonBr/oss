import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Sun, Moon, LogOut, User, Menu, Timer } from 'lucide-react'
import { useAuth, accessTokenExpMs } from '../../contexts/AuthContext'

const pageTitles: Record<string, string> = {
  '/dashboard':    'Dashboard Executivo',
  '/entrada-mensal': 'Entrada Mensal',
  '/aprovacao':    'Aprovação Auditoria',
  '/relatorios':   'Relatórios CMS',
  '/perfil-oss':   'Perfil OSS',
  '/oss':          'Organizações Sociais',
  '/contratos':    'Contratos de Gestão',
  '/unidades':     'Unidades de Saúde',
  '/indicadores':  'Indicadores por Unidade',
  '/metas':        'Metas Anuais',
}

interface HeaderProps {
  onMenuToggle?: () => void
}

function formatSessaoRestante(expMs: number | null): string {
  if (expMs == null) return '—'
  const sec = Math.max(0, Math.floor((expMs - Date.now()) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, token, logout, darkMode, toggleDarkMode } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const expMs = accessTokenExpMs(token)
  useEffect(() => {
    if (expMs == null) return
    const id = window.setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [expMs, token])
  // força rerender do countdown quando o token muda
  useEffect(() => {
    setTick(0)
  }, [token])
  const sessaoLabel = useMemo(() => {
    void tick
    return formatSessaoRestante(expMs)
  }, [expMs, tick])

  // Match longest prefix so /oss/novo → 'Organizações Sociais'
  const pageTitle =
    Object.entries(pageTitles)
      .filter(([key]) => location.pathname === key || location.pathname.startsWith(key + '/'))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'OSS Saúde'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label="Abrir menu lateral"
        aria-controls="sidebar-menu"
        className="mr-2 rounded-lg p-2 text-text-muted hover:bg-hover focus-visible:outline focus-visible:outline-2 md:hidden"
      >
        <Menu size={20} />
      </button>

      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          {pageTitle}
        </h1>
        <p className="text-xs text-text-muted">
          Sistema de Acompanhamento de Contratos de Gestão
        </p>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div
            className="flex min-w-0 max-w-[7.5rem] items-center gap-1 rounded-lg border border-border-subtle bg-surface-alt/80 px-1.5 py-1 text-[10px] sm:max-w-none sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs"
            title="Tempo até a sessão expirar (access token). Ações e troca de módulo renovam a sessão."
          >
            <Timer size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
            <span className="min-w-0 truncate text-text-secondary">
              <span className="sm:hidden" aria-hidden="true">⏱ </span>
              <span className="hidden sm:inline">Sessão: </span>
              <span className="font-mono font-medium text-text-primary tabular-nums">{sessaoLabel}</span>
            </span>
          </div>
        )}

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
