import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EntradaMensalPage from './pages/EntradaMensalPage'
import AprovacaoPage from './pages/AprovacaoPage'
import RelatoriosCMSPage from './pages/RelatoriosCMSPage'
import PerfilOSSPage from './pages/PerfilOSSPage'

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-bg-light p-6 dark:bg-bg-dark">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, user } = useAuth()

  const defaultRoute = () => {
    if (!user) return '/login'
    if (user.perfil === 'contratada_scmc' || user.perfil === 'contratada_indsh') return '/perfil-oss'
    if (user.perfil === 'conselheiro_cms') return '/relatorios'
    return '/dashboard'
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'conselheiro_cms', 'auditora', 'visualizador']}>
            <AppLayout><DashboardPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/entrada-mensal"
        element={
          <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
            <AppLayout><EntradaMensalPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/aprovacao"
        element={
          <ProtectedRoute allowedPerfis={['admin', 'auditora']}>
            <AppLayout><AprovacaoPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorios"
        element={
          <ProtectedRoute allowedPerfis={['admin', 'conselheiro_cms', 'gestor_sms']}>
            <AppLayout><RelatoriosCMSPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil-oss"
        element={
          <ProtectedRoute allowedPerfis={['contratada_scmc', 'contratada_indsh']}>
            <AppLayout><PerfilOSSPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          isAuthenticated
            ? <Navigate to={defaultRoute()} replace />
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  )
}
