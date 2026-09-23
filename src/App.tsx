import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from './components/Layout'

// Pages
import Index from './pages/Index'
import Animais from './pages/Animais'
import ReproducaoPage from './pages/Reproducao'
import SanidadePage from './pages/Sanidade'
import AlimentacaoPage from './pages/Alimentacao'
import PesagemPage from './pages/Pesagem'
import ProducaoPage from './pages/Producao'
import RelatoriosPage from './pages/Relatorios'
import NotFound from './pages/NotFound'

// Auth Pages
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyEmail from './pages/auth/VerifyEmail'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected Application Routes wrapped by Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/animais" element={<Animais />} />
            <Route path="/reproducao" element={<ReproducaoPage />} />
            <Route path="/sanidade" element={<SanidadePage />} />
            <Route path="/alimentacao" element={<AlimentacaoPage />} />
            <Route path="/pesagem" element={<PesagemPage />} />
            <Route path="/producao" element={<ProducaoPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
