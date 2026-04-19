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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('oss_auth')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { user: null, token: null, isAuthenticated: false }
      }
    }
    return { user: null, token: null, isAuthenticated: false }
  })

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('oss_dark_mode') === 'true'
    if (saved) document.documentElement.setAttribute('data-theme', 'dark')
    return saved
  })

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
    const fakeToken = btoa(JSON.stringify({ usuario_id: mockUser.usuario_id, perfil: mockUser.perfil, exp: Date.now() + 3600000 }))
    setAuth({ user: mockUser, token: fakeToken, isAuthenticated: true })
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

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    setDarkMode(next)
  }, [darkMode])

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
