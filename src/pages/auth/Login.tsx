import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tractor, Sparkles, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('lefaxa@icloud.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação. Verifique os dados.'
      setError(msg.includes('Failed to authenticate') ? 'Email ou senha inválidos.' : msg)
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = () => {
    setEmail('lefaxa@icloud.com')
    setPassword('Skip@Pass')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand Left Panel */}
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            <Tractor className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pecuária Manager</h1>
            <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">
              Sistema de Gestão Agropecuária
            </p>
          </div>
        </div>

        <div className="relative z-10 my-auto space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            <span>Módulo de Pecuária Modernizado</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
            Controle total do seu rebanho, reprodução e nutrição em um só lugar.
          </h2>
          <p className="text-base text-white/80 leading-relaxed">
            Substitua planilhas e rotinas legadas com rastreabilidade completa por brinco, histórico
            de pesagem, acompanhamento reprodutivo e sanidade veterinária.
          </p>

          <div className="grid gap-3 pt-4">
            <div className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
              <span>Controle individual e por lote com pesagem e GMD automático</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
              <span>Gestão de coberturas, IATF, partos e lactação em tempo real</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
              <span>Alertas sanitários de vacinas e vermifugação obrigatórias</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-white/70 border-t border-white/10 pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Segurança e alta disponibilidade de dados</span>
          </div>
          <span>v2.5 Pecuária Cloud</span>
        </div>
      </div>

      {/* Auth Right Panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Tractor className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pecuária Manager</h1>
              <p className="text-xs text-muted-foreground">Sistema Agropecuário</p>
            </div>
          </div>

          <Card className="border border-border/80 shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Acessar Sistema</CardTitle>
              <CardDescription>
                Informe seu email e senha de produtor para gerenciar sua fazenda
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="produtor@fazenda.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <div className="rounded-lg bg-muted/60 p-3 border border-border/60 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span>Acesso Demo Pré-configurado:</span>
                    <button
                      type="button"
                      onClick={fillDemo}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Preencher
                    </button>
                  </div>
                  <p>
                    Email:{' '}
                    <span className="font-mono text-foreground font-medium">lefaxa@icloud.com</span>
                  </p>
                  <p>
                    Senha: <span className="font-mono text-foreground font-medium">Skip@Pass</span>
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full font-semibold gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar no Sistema
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Ainda não tem conta?{' '}
                  <Link to="/signup" className="text-primary font-semibold hover:underline">
                    Criar cadastro de fazenda
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
