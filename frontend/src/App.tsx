import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import SidebarMenu from './components/SidebarMenu'
import Header from './components/layout/Header'
import ProtectedRoute from './components/layout/ProtectedRoute'
import { firstAccessiblePath } from './lib/firstAccessiblePath'

const LoginPage          = lazy(() => import('./pages/LoginPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const EntradaMensalHub   = lazy(() => import('./pages/EntradaMensal/EntradaMensalHub'))
const EntradaMensalList  = lazy(() => import('./pages/EntradaMensal/EntradaMensalList'))
const AprovacaoPage      = lazy(() => import('./pages/AprovacaoPage'))
const RelatoriosCMSPage  = lazy(() => import('./pages/RelatoriosCMSPage'))
const PerfilOSSPage      = lazy(() => import('./pages/PerfilOSSPage'))
const OssList            = lazy(() => import('./pages/Oss/OssList'))
const ContratosList      = lazy(() => import('./pages/Contratos/ContratosList'))
const UnidadesList       = lazy(() => import('./pages/Unidades/UnidadesList'))
const IndicadoresList    = lazy(() => import('./pages/Indicadores/IndicadoresList'))
const IndicadoresHub     = lazy(() => import('./pages/Indicadores/IndicadoresHub'))
const MetasHub           = lazy(() => import('./pages/Metas/MetasHub'))
const MetasList          = lazy(() => import('./pages/Metas/MetasList'))
const UsuariosList       = lazy(() => import('./pages/Admin/UsuariosList'))
const PermissoesMatrix   = lazy(() => import('./pages/Admin/PermissoesMatrix'))

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-canvas">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-subtle border-t-primary" />
  </div>
)

/** A cada troca de rota (módulo/página) renova access+refresh, reiniciando o tempo exibido no cabeçalho */
function SessionRenewOnRouteChange() {
  const { isAuthenticated, extendSession } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => {
    if (!isAuthenticated) return
    void extendSession()
  }, [pathname, isAuthenticated, extendSession])
  return null
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden">
      <SessionRenewOnRouteChange />
      <SidebarMenu isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto bg-canvas p-6">{children}</main>
      </div>
    </div>
  )
}

function Guarded({ modulo, children }: { modulo: string; children: React.ReactNode }) {
  return (
    <ProtectedRoute modulo={modulo}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  const { isAuthenticated, canDo } = useAuth()

  const defaultRoute = () => {
    if (!isAuthenticated) return '/login'
    return firstAccessiblePath(canDo)
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard"               element={<Guarded modulo="dashboard"><DashboardPage /></Guarded>} />
        <Route path="/entrada-mensal"          element={<Guarded modulo="entrada_mensal"><EntradaMensalHub /></Guarded>} />
        <Route path="/entrada-mensal/:unidadeId" element={<Guarded modulo="entrada_mensal"><EntradaMensalList /></Guarded>} />
        <Route path="/aprovacao"               element={<Guarded modulo="aprovacao"><AprovacaoPage /></Guarded>} />
        <Route path="/relatorios"              element={<Guarded modulo="relatorios"><RelatoriosCMSPage /></Guarded>} />
        <Route path="/perfil-oss"              element={<Guarded modulo="perfil_oss"><PerfilOSSPage /></Guarded>} />
        <Route path="/oss/*"                   element={<Guarded modulo="oss"><OssList /></Guarded>} />
        <Route path="/contratos/*"             element={<Guarded modulo="contratos"><ContratosList /></Guarded>} />
        <Route path="/unidades/*"              element={<Guarded modulo="unidades"><UnidadesList /></Guarded>} />
        <Route path="/indicadores"             element={<Guarded modulo="indicadores"><IndicadoresHub /></Guarded>} />
        <Route path="/indicadores/:unidadeId/*" element={<Guarded modulo="indicadores"><IndicadoresList /></Guarded>} />
        <Route path="/metas"                   element={<Guarded modulo="metas"><MetasHub /></Guarded>} />
        <Route path="/metas/:indicadorId/*"    element={<Guarded modulo="metas"><MetasList /></Guarded>} />
        <Route path="/admin/usuarios"          element={<Guarded modulo="usuarios"><UsuariosList /></Guarded>} />
        <Route path="/admin/permissoes"        element={<Guarded modulo="permissoes"><PermissoesMatrix /></Guarded>} />

        <Route path="*" element={<Navigate to={defaultRoute()} replace />} />
      </Routes>
    </Suspense>
  )
}
