import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Usuario, Perfil } from '../types'
import { mockUsuarios } from '../data/mock'

interface AuthState {
  user: Usuario | null
  token: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (perfis: Perfil[]) => boolean
  darkMode: boolean
  toggleDarkMode: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function makeToken(u: Usuario) {
  return btoa(JSON.stringify({ usuario_id: u.usuario_id, perfil: u.perfil, exp: Date.now() + 3_600_000 }))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('oss_auth')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* fall through */ }
    }
    // Dev: auto-login as admin so SidebarMenu is always visible during development
    if (import.meta.env.DEV) {
      const admin = mockUsuarios.find(u => u.perfil === 'admin')
      if (admin) return { user: admin, token: makeToken(admin), isAuthenticated: true }
    }
    return { user: null, token: null, isAuthenticated: false }
  })

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('oss_dark_mode') === 'true',
  )

  // Single source of truth for the data-theme attribute and localStorage sync.
  // Keep DOM mutations out of the useState initializer (runs before commit, twice in StrictMode).
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('oss_dark_mode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (auth.isAuthenticated) {
      localStorage.setItem('oss_auth', JSON.stringify(auth))
    } else {
      localStorage.removeItem('oss_auth')
    }
  }, [auth])

  const login = useCallback(async (email: string, _password: string) => {
    // MVP: mock login — in production, call POST /api/auth/login
    const mockUser = mockUsuarios.find(u => u.email === email)
    if (!mockUser) {
      throw new Error('Credenciais inválidas')
    }
    setAuth({ user: mockUser, token: makeToken(mockUser), isAuthenticated: true })
  }, [])

  const logout = useCallback(() => {
    setAuth({ user: null, token: null, isAuthenticated: false })
    localStorage.removeItem('oss_auth')
  }, [])

  const hasPermission = useCallback(
    (perfis: Perfil[]) => {
      if (!auth.user) return false
      return perfis.includes(auth.user.perfil)
    },
    [auth.user],
  )

  // DOM attribute is managed exclusively by the useEffect above; no direct writes here.
  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev)
  }, [])

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, hasPermission, darkMode, toggleDarkMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
