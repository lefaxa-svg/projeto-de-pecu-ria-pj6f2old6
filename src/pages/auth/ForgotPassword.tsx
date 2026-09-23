import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
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
import { Tractor, ArrowLeft, MailCheck, Loader2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await pb.collection('users').requestPasswordReset(email)
      setSent(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar recuperação de senha.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Tractor className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Pecuária Manager</h1>
            <p className="text-xs text-muted-foreground">Recuperação de Acesso</p>
          </div>
        </div>

        <Card className="border border-border/80 shadow-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Esqueci Minha Senha</CardTitle>
            <CardDescription>
              Informe seu email cadastrado para receber instruções de redefinição
            </CardDescription>
          </CardHeader>
          {sent ? (
            <CardContent className="space-y-4 text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <MailCheck className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg text-foreground">
                  Email enviado com sucesso!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Se houver uma conta associada a{' '}
                  <strong className="text-foreground">{email}</strong>, você receberá um link para
                  criar uma nova senha.
                </p>
              </div>
              <Button asChild className="w-full mt-4 font-semibold" variant="outline">
                <Link to="/login" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o Login
                </Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Cadastrado</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@fazenda.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enviando link...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para login
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
