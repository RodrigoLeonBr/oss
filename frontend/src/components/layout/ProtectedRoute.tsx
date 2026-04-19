import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { Perfil } from '../../types'

interface Props {
  children: React.ReactNode
  allowedPerfis?: Perfil[]
}

export default function ProtectedRoute({ children, allowedPerfis }: Props) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedPerfis && user && !allowedPerfis.includes(user.perfil)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-nao-cumprido">403</h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            Acesso não autorizado para o perfil <strong>{user.perfil}</strong>
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
