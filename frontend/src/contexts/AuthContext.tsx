import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Usuario, Perfil, PermissaoPerfil } from '../types'

interface AuthState {
  user: Usuario | null
  token: string | null
  /** Necessário para estender a sessão (sliding) via `/auth/refresh-token` */
  refreshToken: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  permissions: PermissaoPerfil[]
  permissionsLoaded: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Renova access+refresh; chamado após ações e ao mudar de módulo. */
  extendSession: () => Promise<boolean>
  canDo: (modulo: string, action: 'view' | 'insert' | 'update' | 'delete') => boolean
  escopo: (modulo: string) => 'global' | 'proprio' | null
  /** @deprecated Use canDo(modulo, 'view') instead */
  hasPermission: (perfis: Perfil[]) => boolean
  darkMode: boolean
  toggleDarkMode: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_KEY = 'oss_auth'

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
    return (payload.exp ?? 0) < Math.floor(Date.now() / 1000)
  } catch {
    return true
  }
}

/** Expiração do access token em ms (para countdown no cabeçalho) */
export function accessTokenExpMs(token: string | null): number | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
    if (payload.exp == null) return null
    return payload.exp * 1000
  } catch {
    return null
  }
}

let refreshInFlight: Promise<boolean> | null = null

function normalizePermRow(raw: Record<string, unknown>): PermissaoPerfil {
  return {
    perm_id: String(raw.perm_id),
    perfil: raw.perfil as Perfil,
    modulo: String(raw.modulo),
    can_view:   Boolean(raw.can_view),
    can_insert: Boolean(raw.can_insert),
    can_update: Boolean(raw.can_update),
    can_delete: Boolean(raw.can_delete),
    escopo: raw.escopo === 'proprio' ? 'proprio' : 'global',
  }
}

function parseOssAuthFromStorage(): AuthState {
  if (typeof localStorage === 'undefined') {
    return { user: null, token: null, refreshToken: null, isAuthenticated: false }
  }
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return { user: null, token: null, refreshToken: null, isAuthenticated: false }
  try {
    const p = JSON.parse(raw) as Partial<AuthState> & Record<string, unknown> | null
    if (!p || typeof p !== 'object') {
      return { user: null, token: null, refreshToken: null, isAuthenticated: false }
    }
    const token = typeof p.token === 'string' && p.token.trim() ? p.token.trim() : null
    const refreshToken =
      typeof p.refreshToken === 'string' && p.refreshToken.trim() ? p.refreshToken.trim() : null
    const user = p.user && typeof p.user === 'object' ? p.user as Usuario : null
    const wantsAuth = p.isAuthenticated === true
    if (wantsAuth && (!token || !user)) {
      localStorage.removeItem(AUTH_KEY)
      return { user: null, token: null, refreshToken: null, isAuthenticated: false }
    }
    if (!token || !user) {
      return { user: null, token: null, refreshToken: null, isAuthenticated: false }
    }
    if (isTokenExpired(token)) {
      localStorage.removeItem(AUTH_KEY)
      return { user: null, token: null, refreshToken: null, isAuthenticated: false }
    }
    return { user, token, refreshToken, isAuthenticated: true }
  } catch {
    return { user: null, token: null, refreshToken: null, isAuthenticated: false }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(parseOssAuthFromStorage)
  const [permissions, setPermissions] = useState<PermissaoPerfil[]>([])
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('oss_dark_mode') === 'true',
  )

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
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(AUTH_KEY)
    }
  }, [auth])

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.token) {
      setPermissions([])
      setPermissionsLoaded(true)
      return
    }
    setPermissionsLoaded(false)
    setPermissions([])
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/me/permissions', {
          headers: { Authorization: `Bearer ${auth.token}` },
        })
        if (res.status === 401) {
          if (!cancelled) {
            setAuth({ user: null, token: null, refreshToken: null, isAuthenticated: false })
            localStorage.removeItem(AUTH_KEY)
            if (typeof window !== 'undefined') window.location.assign('/login')
          }
          return
        }
        if (!res.ok || cancelled) return
        const body = (await res.json()) as { data?: Record<string, unknown>[] }
        const list = Array.isArray(body.data) ? body.data.map(normalizePermRow) : []
        if (!cancelled) setPermissions(list)
      } catch {
        if (!cancelled) setPermissions([])
      } finally {
        if (!cancelled) setPermissionsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth.isAuthenticated, auth.token])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message || 'Credenciais inválidas')
    }
    const body = await res.json()
    const user: Usuario = body.data
    const token: string = body.tokens.access.token
    const refreshT =
      body.tokens?.refresh?.token && typeof body.tokens.refresh.token === 'string'
        ? body.tokens.refresh.token
        : null
    setAuth({ user, token, refreshToken: refreshT, isAuthenticated: true })
  }, [])

  const extendSession = useCallback(async (): Promise<boolean> => {
    const rt = auth.refreshToken
    if (!rt?.trim()) return false
    if (refreshInFlight) return refreshInFlight
    const run = (async () => {
      try {
        const res = await fetch('/api/auth/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt.trim() }),
        })
        if (!res.ok) return false
        const data = (await res.json()) as {
          access?: { token?: string }
          refresh?: { token?: string }
        }
        const newAccess = data.access?.token
        const newRefresh = data.refresh?.token
        if (!newAccess || !newRefresh) return false
        setAuth(prev => {
          if (!prev.user || !prev.isAuthenticated) return prev
          return {
            ...prev,
            token: newAccess,
            refreshToken: newRefresh,
            isAuthenticated: true,
          }
        })
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()
    refreshInFlight = run
    return run
  }, [auth.refreshToken, auth.isAuthenticated, auth.user])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (auth.isAuthenticated) return
    const devEmail = import.meta.env.VITE_DEV_EMAIL
    const devPassword = import.meta.env.VITE_DEV_PASSWORD
    if (!devEmail || !devPassword) return
    login(devEmail, devPassword).catch((err: Error) => {
      console.warn('[DEV] Auto-login failed:', err.message)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = useCallback(() => {
    setAuth({ user: null, token: null, refreshToken: null, isAuthenticated: false })
    setPermissions([])
    setPermissionsLoaded(false)
    localStorage.removeItem(AUTH_KEY)
  }, [])

  const canDo = useCallback(
    (modulo: string, action: 'view' | 'insert' | 'update' | 'delete'): boolean => {
      const key = `can_${action}` as keyof PermissaoPerfil
      const perm = permissions.find(p => p.modulo === modulo)
      if (!perm) return false
      return Boolean(perm[key])
    },
    [permissions],
  )

  const escopo = useCallback(
    (modulo: string): 'global' | 'proprio' | null => {
      const perm = permissions.find(p => p.modulo === modulo)
      return perm ? perm.escopo : null
    },
    [permissions],
  )

  const hasPermission = useCallback(
    (perfis: Perfil[]) => {
      if (!auth.user) return false
      return perfis.includes(auth.user.perfil)
    },
    [auth.user],
  )

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        permissions,
        permissionsLoaded,
        login,
        logout,
        extendSession,
        canDo,
        escopo,
        hasPermission,
        darkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
