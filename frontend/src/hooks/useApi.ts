import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
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
        logout()
        throw new Error('Sessão expirada')
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Erro ${res.status}`)
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

  return { get, post, put, request }
}
