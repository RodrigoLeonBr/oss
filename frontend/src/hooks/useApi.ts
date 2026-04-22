import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

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

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
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
        const body = await res.json().catch(() => ({}))
        const serverMsg: string = body.message || body.error || ''
        throw new ApiError(res.status, serverMsg || `Erro HTTP ${res.status}`)
      }

      return res.json()
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
