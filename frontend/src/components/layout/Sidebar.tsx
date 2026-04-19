import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardEdit,
  ShieldCheck,
  FileBarChart2,
  Building2,
  ChevronLeft,
  ChevronRight,
  Heart,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { Perfil } from '../../types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  perfis: Perfil[]
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={20} />,
    perfis: ['admin', 'gestor_sms', 'conselheiro_cms', 'auditora', 'visualizador'],
  },
  {
    to: '/entrada-mensal',
    label: 'Entrada Mensal',
    icon: <ClipboardEdit size={20} />,
    perfis: ['admin', 'gestor_sms'],
  },
  {
    to: '/aprovacao',
    label: 'Aprovação',
    icon: <ShieldCheck size={20} />,
    perfis: ['admin', 'auditora'],
  },
  {
    to: '/relatorios',
    label: 'Relatórios CMS',
    icon: <FileBarChart2 size={20} />,
    perfis: ['admin', 'conselheiro_cms', 'gestor_sms'],
  },
  {
    to: '/perfil-oss',
    label: 'Perfil OSS',
    icon: <Building2 size={20} />,
    perfis: ['contratada_scmc', 'contratada_indsh'],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()

  const visibleItems = navItems.filter(
    item => user && item.perfis.includes(user.perfil),
  )

  return (
    <aside
      className={`flex h-screen flex-col border-r border-border-light bg-surface-light transition-all duration-300 dark:border-border-dark dark:bg-surface-dark ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-border-light px-4 dark:border-border-dark">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Heart size={24} className="text-primary" />
            <span className="text-sm font-bold text-primary">OSS Saúde</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2" aria-label="Menu principal">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={item.label}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-border-light p-4 dark:border-border-dark">
          <p className="text-xs text-slate-400">Americana/SP</p>
          <p className="text-xs text-slate-400">v1.0.0 MVP</p>
        </div>
      )}
    </aside>
  )
}
