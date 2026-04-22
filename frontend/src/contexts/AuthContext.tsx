import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Usuario, Perfil } from '../types'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('oss_auth')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* fall through */ }
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || 'Credenciais inválidas')
    }
    const body = await res.json()
    // Backend returns: { data: { ...user }, tokens: { access: { token }, refresh: { token } } }
    const user: Usuario = body.data
    const token: string = body.tokens.access.token
    setAuth({ user, token, isAuthenticated: true })
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (auth.isAuthenticated) return
    const devEmail = import.meta.env.VITE_DEV_EMAIL
    const devPassword = import.meta.env.VITE_DEV_PASSWORD
    if (!devEmail || !devPassword) return
    login(devEmail, devPassword).catch((err) => {
      console.warn('[DEV] Auto-login failed:', err.message)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
