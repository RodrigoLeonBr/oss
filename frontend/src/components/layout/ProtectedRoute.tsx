import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  children: React.ReactNode
  modulo: string
}

export default function ProtectedRoute({ children, modulo }: Props) {
  const { isAuthenticated, permissionsLoaded, canDo } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!permissionsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-subtle border-t-primary" />
      </div>
    )
  }

  if (!canDo(modulo, 'view')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-nao-cumprido">403</h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            Acesso não autorizado a este módulo.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
