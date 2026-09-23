import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tractor, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de verificação não informado.')
      return
    }

    pb.collection('users')
      .confirmVerification(token)
      .then(() => {
        setStatus('success')
      })
      .catch((err: unknown) => {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Falha na validação do email.')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Tractor className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Pecuária Manager</h1>
            <p className="text-xs text-muted-foreground">Validação de Cadastro</p>
          </div>
        </div>

        <Card className="border border-border/80 shadow-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Confirmação de Email</CardTitle>
            <CardDescription>Processo de verificação de conta de produtor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center py-4">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Confirmando validação com o servidor...
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">
                    Conta Verificada com Sucesso!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seu endereço de email foi confirmado. Você já pode desfrutar de todos os
                    recursos da fazenda.
                  </p>
                </div>
                <Button asChild className="w-full font-semibold">
                  <Link to="/login">Entrar no Sistema</Link>
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Falha na Verificação</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {errorMessage || 'O link pode ter expirado ou já foi utilizado.'}
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full font-semibold">
                  <Link to="/login">Voltar para Login</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
