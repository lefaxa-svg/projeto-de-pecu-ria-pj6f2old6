import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { Tractor, Sparkles, ArrowRight, Loader2, Check } from 'lucide-react'

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()

  const [name, setName] = useState('')
  const [fazendaNome, setFazendaNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordLengthOk = password.length >= 8
  const passwordMatch = password.length > 0 && password === passwordConfirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    try {
      await signup(name, fazendaNome, email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar fazenda.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
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
              Novo Produtor
            </p>
          </div>
        </div>

        <div className="relative z-10 my-auto space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            <span>Implantação Rápida</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
            Comece a digitalizar sua fazenda hoje mesmo.
          </h2>
          <p className="text-base text-white/80 leading-relaxed">
            Cadastre os brincos dos animais, agende protocolos reprodutivos e acompanhe os lotes com
            ganho de peso em tempo real.
          </p>
        </div>

        <div className="relative z-10 text-xs text-white/70 border-t border-white/10 pt-6">
          Pecuária Cloud • Plataforma Especializada para Bovinocultura
        </div>
      </div>

      {/* Auth Right Panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Criar Cadastro da Fazenda</CardTitle>
              <CardDescription>Informe seus dados para iniciar a gestão do rebanho</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Produtor ou Administrador</Label>
                  <Input
                    id="name"
                    placeholder="Ex: João da Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fazenda">Nome da Fazenda / Propriedade</Label>
                  <Input
                    id="fazenda"
                    placeholder="Ex: Fazenda Santa Maria"
                    value={fazendaNome}
                    onChange={(e) => setFazendaNome(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@fazenda.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 8 dígitos"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordConfirm">Confirmar Senha</Label>
                    <Input
                      id="passwordConfirm"
                      type="password"
                      placeholder="Repita a senha"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password strength checklist */}
                <div className="space-y-1 text-xs text-muted-foreground pt-1">
                  <div
                    className={`flex items-center gap-1.5 ${passwordLengthOk ? 'text-emerald-600 font-medium' : ''}`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${passwordLengthOk ? 'opacity-100' : 'opacity-40'}`}
                    />
                    <span>Mínimo de 8 caracteres</span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 ${passwordMatch ? 'text-emerald-600 font-medium' : ''}`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${passwordMatch ? 'opacity-100' : 'opacity-40'}`}
                    />
                    <span>Confirmação idêntica</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full font-semibold gap-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      Finalizar Cadastro
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Já possui conta cadastrada?{' '}
                  <Link to="/login" className="text-primary font-semibold hover:underline">
                    Fazer login
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
