import { useCallback } from 'react'
import { useAuth, accessTokenExpMs } from '../contexts/AuthContext'

/** Só chama /auth/refresh-token se o access estiver a expirar (evita loop + 502 em rajada) */
const SLIDING_EXTEND_WHEN_WITHIN_MS = 4 * 60 * 1000

function maybeExtendSession(
  accessToken: string | null,
  extendSession: () => Promise<boolean>,
) {
  if (!accessToken) return
  const expMs = accessTokenExpMs(accessToken)
  if (expMs == null) return
  if (expMs - Date.now() > SLIDING_EXTEND_WHEN_WITHIN_MS) return
  void extendSession().catch(() => {})
}

const AUTH_KEY = 'oss_auth'

function readTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { token?: string | null; isAuthenticated?: boolean }
    if (p.isAuthenticated === true && (!p.token || typeof p.token !== 'string')) return null
    if (typeof p.token !== 'string' || !p.token.trim()) return null
    return p.token.trim()
  } catch {
    return null
  }
}

/** Só padrões típicos de middleware auth — evita confundir com erros de validação */
function isAuthFailureMessage(msg: string, status: number): boolean {
  if (status === 401) return true
  if (!msg.trim()) return false
  const s = msg.toLowerCase()
  // Mensagem em qualquer status (ex.: 500 com corpo { message: "Please authenticate" })
  if (/please authenticate|you must be logged|fa[cç]a login|n[aã]o autenticad/.test(s)) return true
  if (status === 403 && /unauthoriz|forbidden|authenticate/.test(s)) return true
  return false
}

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
}

// Erro tipado com status HTTP — permite distinguir 404, 409, 500 nos componentes
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  window.location.assign('/login')
}

export function useApi() {
  const { token, logout, extendSession } = useAuth()

  const request = useCallback(
    async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      }

      const fromContext = typeof token === 'string' && token.trim() ? token.trim() : null
      const accessToken = fromContext ?? readTokenFromStorage()
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
      })

      const text = await res.text()
      let body: Record<string, unknown> = {}
      if (text.trim()) {
        try {
          body = JSON.parse(text) as Record<string, unknown>
        } catch {
          body = { message: text }
        }
      }

      const serverMsg = String(
        (body?.message as string) || (body?.error as string) || (body as { msg?: string }).msg || '',
      )

      const looksUnauthorized =
        isAuthFailureMessage(serverMsg, res.status)
        || (res.status === 500 && body?.code === 401)

      if (looksUnauthorized) {
        logout()
        redirectToLogin()
        throw new ApiError(401, serverMsg || 'Sessão inválida. Faça login novamente.')
      }

      if (!res.ok) {
        const code =
          typeof body.code === 'number' && body.code >= 400 && res.status === 500
            ? body.code
            : res.status
        throw new ApiError(
          code,
          serverMsg || `Erro HTTP ${res.status}`,
        )
      }

      if (res.status === 204 || res.status === 205) {
        maybeExtendSession(accessToken, extendSession)
        return undefined as T
      }

      if (!text.trim()) {
        maybeExtendSession(accessToken, extendSession)
        return undefined as T
      }

      maybeExtendSession(accessToken, extendSession)
      return JSON.parse(text) as T
    },
    [token, logout, extendSession],
  )

  const get = useCallback(<T>(endpoint: string) => request<T>(endpoint), [request])

  const post = useCallback(
    <T>(endpoint: string, data: unknown) =>
      request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    [request],
  )

  const put = useCallback(
    <T>(endpoint: string, data: unknown) =>
      request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    [request],
  )

  const del = useCallback(
    <T = void>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
    [request],
  )

  return { get, post, put, del, request }
}
