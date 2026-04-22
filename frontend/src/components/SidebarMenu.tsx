import { useState, useCallback, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardEdit,
  ShieldCheck,
  FileBarChart2,
  Building2,
  Building,
  FileText,
  Hospital,
  Target,
  BarChart3,
  ChevronDown,
  X,
  Heart,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { Perfil } from '../types'

// ─── Public contract ───────────────────────────────────────────────────────
export interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  /** Simplified role: 'admin' → full access; 'oss' → contratada read-only */
  userPerfil: 'admin' | 'oss'
}

// ─── Internal types ─────────────────────────────────────────────────────────
interface SubMenuItem {
  to: string
  label: string
  icon: React.ReactNode
  perfis: Perfil[]
}

interface MenuGroup {
  id: string
  label: string
  icon: React.ReactNode
  perfis: Perfil[]
  subItems: SubMenuItem[]
}

// ─── Itens de navegação direta (sem accordion) ───────────────────────────────
interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  perfis: Perfil[]
  /** Se false, o link fica ativo em sub-rotas também (padrão: true) */
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
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

// ─── Static menu definition ──────────────────────────────────────────────────
const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <Building size={20} />,
    perfis: ['admin', 'gestor_sms', 'auditora', 'contratada_scmc', 'contratada_indsh'],
    subItems: [
      {
        to: '/oss',
        label: 'Organizações Sociais',
        icon: <Building size={14} />,
        perfis: ['admin', 'gestor_sms'],
      },
      {
        to: '/contratos',
        label: 'Contratos de Gestão',
        icon: <FileText size={14} />,
        perfis: ['admin', 'gestor_sms'],
      },
      {
        to: '/unidades',
        label: 'Unidades de Saúde',
        icon: <Hospital size={14} />,
        perfis: ['admin', 'gestor_sms', 'contratada_scmc', 'contratada_indsh'],
      },
      {
        to: '/indicadores',
        label: 'Indicadores por Unidade',
        icon: <BarChart3 size={14} />,
        perfis: ['admin', 'gestor_sms', 'auditora', 'contratada_scmc', 'contratada_indsh'],
      },
      {
        to: '/metas',
        label: 'Metas Anuais',
        icon: <Target size={14} />,
        perfis: ['admin', 'gestor_sms', 'contratada_scmc', 'contratada_indsh'],
      },
    ],
  },
]

// ─── RBAC helper: maps simplified prop role → Perfil[] ───────────────────────
const OSS_PERFIS: Perfil[] = ['contratada_scmc', 'contratada_indsh']

// ─── Component ───────────────────────────────────────────────────────────────
const SidebarMenu: React.FC<SidebarProps> = ({ isOpen, onToggle, userPerfil }) => {
  const { user, hasPermission } = useAuth()
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)

  // ── Auto-open the group whose subItem path matches the current URL ──
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = MENU_GROUPS.find(g =>
      g.subItems.some(s => location.pathname.startsWith(s.to)),
    )
    return active ? new Set([active.id]) : new Set()
  })

  // ── Close mobile sidebar on route change ──
  const onToggleRef = useRef(onToggle)
  onToggleRef.current = onToggle
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  useEffect(() => {
    if (isOpenRef.current && window.innerWidth < 768) {
      onToggleRef.current()
    }
  }, [location.pathname])

  // ── RBAC: prefer fine-grained AuthContext; fallback to userPerfil prop ──
  const canView = useCallback(
    (required: Perfil[]): boolean => {
      if (user) return hasPermission(required)
      if (userPerfil === 'admin') return true
      if (userPerfil === 'oss') return required.some(p => OSS_PERFIS.includes(p))
      return false
    },
    [user, hasPermission, userPerfil],
  )

  // ── Accordion toggle ──
  const toggleGroup = useCallback((id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // ── Close mobile when link is clicked ──
  const handleLinkClick = useCallback(() => {
    if (window.innerWidth < 768 && isOpenRef.current) {
      onToggleRef.current()
    }
  }, [])

  // ── Keyboard navigation: ArrowUp / ArrowDown within the nav ──
  const handleNavKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (!navRef.current) return

    const focusable = Array.from(
      navRef.current.querySelectorAll<HTMLElement>('button[data-navitem], a[data-navitem]'),
    ).filter(el => !el.closest('[hidden]'))

    const idx = focusable.indexOf(document.activeElement as HTMLElement)
    if (idx === -1) return

    e.preventDefault()
    if (e.key === 'ArrowDown') focusable[Math.min(idx + 1, focusable.length - 1)]?.focus()
    else focusable[Math.max(idx - 1, 0)]?.focus()
  }, [])

  const visibleItems  = NAV_ITEMS.filter(item => canView(item.perfis))
  const visibleGroups = MENU_GROUPS.filter(g => canView(g.perfis))

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        id="sidebar-menu"
        aria-label="Menu de navegação principal"
        className={[
          // Layout
          'fixed left-0 top-0 z-50 flex h-screen w-64 md:w-72 flex-col',
          // Colours — light
          'bg-gradient-to-b from-blue-50 to-indigo-100',
          // Colours — dark
          'dark:from-slate-900/95 dark:to-slate-900',
          // Border
          'border-r border-blue-200 dark:border-slate-700',
          // Scroll
          'overflow-hidden',
          // Transition
          'transition-transform duration-300 ease-in-out',
          // Desktop: in-flow flex item (sticky fails inside overflow:hidden parent)
          'md:relative md:translate-x-0 md:z-auto md:left-auto md:top-auto',
          // Mobile: slide in/out
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        ].join(' ')}
      >
        {/* ── Logo / header ── */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-blue-200 dark:border-slate-700 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <Heart size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-blue-900 dark:text-white">
                OSS Saúde
              </p>
              <p className="truncate text-[10px] leading-tight text-blue-500 dark:text-slate-400">
                Americana / SP
              </p>
            </div>
          </div>

          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={onToggle}
            aria-label="Fechar menu lateral"
            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── User badge ── */}
        {user && (
          <div className="mx-3 mt-3 shrink-0 rounded-lg border border-blue-100 bg-white/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="truncate text-xs font-semibold text-blue-900 dark:text-white">
              {user.nome}
            </p>
            <p className="truncate text-[10px] capitalize text-blue-500 dark:text-slate-400">
              {user.perfil.replace(/_/g, ' ')}
            </p>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav
          ref={navRef}
          aria-label="Menu principal"
          className="flex-1 overflow-y-auto px-2 py-3"
          onKeyDown={handleNavKeyDown}
        >
          {/* ── Itens diretos (Dashboard, Entrada Mensal, etc.) ── */}
          {visibleItems.length > 0 && (
            <ul role="list" className="space-y-0.5">
              {visibleItems.map(item => (
                <li key={item.to} role="listitem">
                  <NavLink
                    data-navitem
                    to={item.to}
                    end={item.end !== false}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                        'transition-all duration-150',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                        isActive
                          ? 'bg-blue-200 font-bold text-blue-900 dark:bg-slate-700 dark:text-white'
                          : 'text-blue-800 hover:bg-blue-100/50 dark:text-slate-300 dark:hover:bg-slate-800/50',
                      ].join(' ')
                    }
                  >
                    <span className="shrink-0 text-blue-400 dark:text-slate-500">{item.icon}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}

          {/* ── Divisor ── */}
          {visibleItems.length > 0 && visibleGroups.length > 0 && (
            <div className="my-2 border-t border-blue-200 dark:border-slate-700" role="separator" />
          )}

          {/* ── Grupos CRUD com accordion ── */}
          <ul role="list" className="space-y-0.5">
            {visibleGroups.map(group => {
              const isExpanded = openGroups.has(group.id)
              const isGroupActive = group.subItems.some(s => location.pathname.startsWith(s.to))
              const visibleSubItems = group.subItems.filter(item => canView(item.perfis))

              return (
                <li key={group.id} role="listitem">
                  {/* Accordion trigger */}
                  <button
                    data-navitem
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setOpenGroups(prev => { const n = new Set(prev); n.delete(group.id); return n })
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`submenu-${group.id}`}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      'transition-all duration-150',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                      isGroupActive && !isExpanded
                        ? 'bg-blue-200 font-bold text-blue-900 dark:bg-slate-700 dark:text-white'
                        : 'text-blue-800 hover:bg-blue-100/50 dark:text-slate-300 dark:hover:bg-slate-800/50',
                    ].join(' ')}
                  >
                    <span
                      className={
                        isGroupActive
                          ? 'shrink-0 text-blue-600 dark:text-blue-400'
                          : 'shrink-0 text-blue-400 dark:text-slate-500'
                      }
                    >
                      {group.icon}
                    </span>

                    <span className="flex-1 text-left leading-snug">{group.label}</span>

                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={[
                        'shrink-0 text-blue-400 transition-transform duration-200 dark:text-slate-500',
                        isExpanded ? 'rotate-180' : '',
                      ].join(' ')}
                    />
                  </button>

                  {/* Submenu */}
                  <div
                    id={`submenu-${group.id}`}
                    role="group"
                    aria-label={`Submenu de ${group.label}`}
                    hidden={!isExpanded}
                  >
                    {isExpanded && (
                      <ul
                        role="list"
                        className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-blue-200 pl-3 dark:border-slate-700"
                      >
                        {visibleSubItems.map(item => (
                          <li key={item.to} role="listitem">
                            <NavLink
                              data-navitem
                              to={item.to}
                              end={false}
                              onClick={handleLinkClick}
                              className={({ isActive }) =>
                                [
                                  'flex items-center gap-2 rounded-md px-2.5 py-[7px] text-xs',
                                  'transition-all duration-150',
                                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
                                  isActive
                                    ? 'bg-blue-200 font-bold text-blue-900 dark:bg-slate-700 dark:text-white'
                                    : 'font-medium text-blue-700 hover:bg-blue-100/50 hover:text-blue-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white',
                                ].join(' ')
                              }
                              aria-label={item.label}
                            >
                              <span className="shrink-0 text-blue-400 dark:text-slate-500">
                                {item.icon}
                              </span>
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-blue-200 px-4 py-3 dark:border-slate-700">
          <p className="text-[10px] text-blue-400 dark:text-slate-500">
            v1.0.0 MVP · Americana / SP
          </p>
        </div>
      </aside>
    </>
  )
}

export default SidebarMenu
