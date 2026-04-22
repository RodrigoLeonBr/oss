import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const AUTH_KEY = 'oss_auth'

function readTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { token?: string | null }
    return p.token && typeof p.token === 'string' ? p.token : null
  } catch {
    return null
  }
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

export function useApi() {
  const { token, logout } = useAuth()

  const request = useCallback(
    async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      }

      const accessToken = token ?? readTokenFromStorage()
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
      })

      if (res.status === 401) {
        // Em DEV, não força logout: o componente cai no catch e usa dados mock.
        // Em PROD (backend real), logout imediato por sessão expirada.
        if (!import.meta.env.DEV) {
          logout()
        }
        throw new ApiError(401, 'Sessão expirada. Faça login novamente.')
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string; code?: number }
        const serverMsg: string = body.message || body.error || ''
        // Se o proxy/servidor devolve 500 com corpo { code: 401 }, alinhar ao código semântico
        const code =
          typeof body.code === 'number' && body.code >= 400 && res.status === 500 ? body.code : res.status
        throw new ApiError(code, serverMsg || `Erro HTTP ${res.status}`)
      }

      if (res.status === 204 || res.status === 205) {
        return undefined as T
      }

      const text = await res.text()
      if (!text.trim()) {
        return undefined as T
      }

      return JSON.parse(text) as T
    },
    [token, logout],
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
