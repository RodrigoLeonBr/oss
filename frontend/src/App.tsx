import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import SidebarMenu from './components/SidebarMenu'
import Header from './components/layout/Header'
import ProtectedRoute from './components/layout/ProtectedRoute'
import type { Perfil } from './types'

// ─── Lazy-loaded pages (cada página vira um chunk separado no build) ──────────
const LoginPage         = lazy(() => import('./pages/LoginPage'))
const DashboardPage     = lazy(() => import('./pages/DashboardPage'))
const EntradaMensalHub  = lazy(() => import('./pages/EntradaMensal/EntradaMensalHub'))
const EntradaMensalList = lazy(() => import('./pages/EntradaMensal/EntradaMensalList'))
const AprovacaoPage     = lazy(() => import('./pages/AprovacaoPage'))
const RelatoriosCMSPage = lazy(() => import('./pages/RelatoriosCMSPage'))
const PerfilOSSPage     = lazy(() => import('./pages/PerfilOSSPage'))
const OssList           = lazy(() => import('./pages/Oss/OssList'))
const ContratosList     = lazy(() => import('./pages/Contratos/ContratosList'))
const UnidadesList      = lazy(() => import('./pages/Unidades/UnidadesList'))
const IndicadoresList   = lazy(() => import('./pages/Indicadores/IndicadoresList'))
const IndicadoresHub    = lazy(() => import('./pages/Indicadores/IndicadoresHub'))
const MetasHub          = lazy(() => import('./pages/Metas/MetasHub'))
const MetasList         = lazy(() => import('./pages/Metas/MetasList'))

// Mapeia perfis granulares → prop simplificada do SidebarMenu
function toSidebarPerfil(perfil: Perfil | undefined): 'admin' | 'oss' {
  return perfil === 'contratada_scmc' || perfil === 'contratada_indsh' ? 'oss' : 'admin'
}

// ─── Layout principal (sidebar + header + conteúdo) ──────────────────────────
function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarMenu
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)}
        userPerfil={toSidebarPerfil(user?.perfil)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto bg-canvas p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, user } = useAuth()

  const defaultRoute = () => {
    if (!user) return '/login'
    if (user.perfil === 'contratada_scmc' || user.perfil === 'contratada_indsh') return '/perfil-oss'
    if (user.perfil === 'conselheiro_cms') return '/relatorios'
    return '/dashboard'
  }

  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-subtle border-t-primary" />
      </div>
    }>
      <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* ── Rotas existentes ── */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'conselheiro_cms', 'auditora', 'visualizador']}>
          <AppLayout><DashboardPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/entrada-mensal" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
          <AppLayout><EntradaMensalHub /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/entrada-mensal/:unidadeId" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
          <AppLayout><EntradaMensalList /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/aprovacao" element={
        <ProtectedRoute allowedPerfis={['admin', 'auditora']}>
          <AppLayout><AprovacaoPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/relatorios" element={
        <ProtectedRoute allowedPerfis={['admin', 'conselheiro_cms', 'gestor_sms']}>
          <AppLayout><RelatoriosCMSPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/perfil-oss" element={
        <ProtectedRoute allowedPerfis={['contratada_scmc', 'contratada_indsh']}>
          <AppLayout><PerfilOSSPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── CRUD: Organizações Sociais ── */}
      <Route path="/oss/*" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
          <AppLayout><OssList /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── CRUD: Contratos de Gestão ── */}
      <Route path="/contratos/*" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms']}>
          <AppLayout><ContratosList /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── CRUD: Unidades de Saúde ── */}
      <Route path="/unidades/*" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'contratada_scmc', 'contratada_indsh']}>
          <AppLayout><UnidadesList /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── CRUD: Indicadores por Unidade ── */}
      <Route path="/indicadores" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'auditora', 'contratada_scmc', 'contratada_indsh']}>
          <AppLayout><IndicadoresHub /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/indicadores/:unidadeId/*" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'auditora', 'contratada_scmc', 'contratada_indsh']}>
          <AppLayout><IndicadoresList /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── CRUD: Metas Anuais ── */}
      <Route path="/metas" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'contratada_scmc', 'contratada_indsh']}>
          <AppLayout><MetasHub /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/metas/:indicadorId/*" element={
        <ProtectedRoute allowedPerfis={['admin', 'gestor_sms', 'contratada_scmc', 'contratada_indsh']}>
          <AppLayout><MetasList /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="*" element={
        isAuthenticated
          ? <Navigate to={defaultRoute()} replace />
          : <Navigate to="/login" replace />
      } />
    </Routes>
    </Suspense>
  )
}
