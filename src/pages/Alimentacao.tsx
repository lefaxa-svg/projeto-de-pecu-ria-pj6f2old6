import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Animal, Alimentacao, TipoAlimento } from '@/types/pecuaria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { Wheat, Plus, Scale, Search, Sprout, Apple } from 'lucide-react'

const ALIMENTOS_INFO: Record<TipoAlimento, { label: string; desc: string; iconColor: string }> = {
  silagem: {
    label: 'Silagem de Milho/Sorgo',
    desc: 'Base volumosa de alta digestibilidade',
    iconColor: 'text-amber-600',
  },
  racao: {
    label: 'Ração Concentrada',
    desc: 'Proteína e energia balanceadas',
    iconColor: 'text-orange-600',
  },
  sal_mineral: {
    label: 'Sal Mineral / Proteinado',
    desc: 'Micro e macrominerais em cocho coberto',
    iconColor: 'text-blue-600',
  },
  pasto: {
    label: 'Pasto / Rotacionado',
    desc: 'Massa forrageira (Brachiaria/Panicum)',
    iconColor: 'text-emerald-600',
  },
}

export default function AlimentacaoPage() {
  const { user } = useAuth()
  const [alimentacoes, setAlimentacoes] = useState<Alimentacao[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    animal_id: '',
    data: new Date().toISOString().substring(0, 10),
    alimento: 'silagem' as TipoAlimento,
    quantidade_kg: '',
    suplemento: '',
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [aliRes, animRes] = await Promise.all([
        pb.collection('alimentacao').getFullList<Alimentacao>({
          sort: '-data',
          expand: 'animal_id',
        }),
        pb.collection('animais').getFullList<Animal>({
          sort: 'brinco',
        }),
      ])
      setAlimentacoes(aliRes)
      setAnimais(animRes)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    pb.collection('alimentacao')
      .subscribe('*', () => loadData())
      .catch(() => {})
    return () => {
      pb.collection('alimentacao')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [])

  // Diet totals by type
  const dietTotals = {
    silagem: alimentacoes
      .filter((a) => a.alimento === 'silagem')
      .reduce((acc, c) => acc + c.quantidade_kg, 0),
    racao: alimentacoes
      .filter((a) => a.alimento === 'racao')
      .reduce((acc, c) => acc + c.quantidade_kg, 0),
    sal_mineral: alimentacoes
      .filter((a) => a.alimento === 'sal_mineral')
      .reduce((acc, c) => acc + c.quantidade_kg, 0),
    pasto: alimentacoes
      .filter((a) => a.alimento === 'pasto')
      .reduce((acc, c) => acc + c.quantidade_kg, 0),
  }

  const handleSaveFeeding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.quantidade_kg) return
    setSaving(true)

    try {
      await pb.collection('alimentacao').create({
        animal_id: formData.animal_id || null,
        data: formData.data,
        alimento: formData.alimento,
        quantidade_kg: parseFloat(formData.quantidade_kg),
        suplemento: formData.suplemento.trim() || null,
        observacoes: formData.observacoes.trim() || null,
        dono_id: user.id,
      })

      toast({
        title: 'Alimentação Registrada',
        description: 'Lançamento de trato e suplementação efetuado com sucesso.',
      })

      setModalOpen(false)
      setFormData({
        animal_id: '',
        data: new Date().toISOString().substring(0, 10),
        alimento: 'silagem',
        quantidade_kg: '',
        suplemento: '',
        observacoes: '',
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao registrar alimentação',
        description: err instanceof Error ? err.message : 'Falha ao salvar dados de trato',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredFeedings = alimentacoes.filter((a) => {
    const animal = a.expand?.animal_id
    const txt =
      `${animal?.brinco || ''} ${animal?.nome || ''} ${a.alimento} ${a.suplemento || ''}`.toLowerCase()
    return txt.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Wheat className="h-7 w-7 text-primary" />
            Nutrição & Manejo Alimentar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Controle do fornecimento diário de volumoso, ração concentrada, sal mineral e
            suplementos
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2 font-semibold shadow-xs">
          <Plus className="h-4 w-4" />
          Registrar Alimentação
        </Button>
      </div>

      {/* Diet Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Silagem Fornecida</span>
              <Sprout className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {dietTotals.silagem} kg
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Volumoso armazenado</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Ração Concentrada</span>
              <Apple className="h-4 w-4 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{dietTotals.racao} kg</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Energia e proteína</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Sal Mineral / Proteinado</span>
              <Scale className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {dietTotals.sal_mineral} kg
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Consumo em cocho</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Pasto Estimado</span>
              <Wheat className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{dietTotals.pasto} kg</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Matéria verde / pastejo</p>
          </CardContent>
        </Card>
      </div>

      {/* Feeding Log Table */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por alimento, animal ou lote..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium self-start sm:self-auto">
            Total de <strong>{filteredFeedings.length}</strong> registros de alimentação
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">Animal / Lote</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Alimento</th>
                <th className="px-4 py-3 font-semibold">Quantidade</th>
                <th className="px-4 py-3">Suplemento / Aditivo</th>
                <th className="px-4 py-3">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Carregando histórico de trato...
                  </td>
                </tr>
              ) : filteredFeedings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhum registro de alimentação cadastrado.
                  </td>
                </tr>
              ) : (
                filteredFeedings.map((item) => {
                  const animal = item.expand?.animal_id
                  return (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-foreground">
                        {animal ? (
                          <div>
                            <span>{animal.brinco}</span>
                            {animal.nome && (
                              <span className="text-xs text-muted-foreground font-normal ml-1">
                                ({animal.nome})
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-foreground text-xs">
                            Trato de Lote Coletivo
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5 capitalize font-medium text-foreground">
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.alimento.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 font-bold tabular-nums text-foreground">
                        {item.quantidade_kg} kg
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {item.suplemento || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {item.observacoes || 'Trato habitual fornecido'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Feeding Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wheat className="h-5 w-5 text-primary" />
              Registrar Trato ou Suplementação
            </DialogTitle>
            <DialogDescription>
              Informe o lote ou animal e os valores nutricionais fornecidos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFeeding} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Animal Específico ou Trato Geral de Lote</Label>
              <Select
                value={formData.animal_id}
                onValueChange={(val) => setFormData({ ...formData, animal_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lote Coletivo (ou selecione um animal)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lote_geral">Lote Coletivo / Todo Rebanho</SelectItem>
                  {animais.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.brinco} {a.nome ? `- ${a.nome}` : ''} ({a.categoria})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Alimento *</Label>
                <Select
                  value={formData.alimento}
                  onValueChange={(val: TipoAlimento) => setFormData({ ...formData, alimento: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silagem">Silagem (Milho/Capim)</SelectItem>
                    <SelectItem value="racao">Ração Concentrada</SelectItem>
                    <SelectItem value="sal_mineral">Sal Mineral / Proteinado</SelectItem>
                    <SelectItem value="pasto">Pasto / Piquete Rotacionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data">Data do Trato *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qtd">Quantidade (kg) *</Label>
                <Input
                  id="qtd"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 25"
                  value={formData.quantidade_kg}
                  onChange={(e) => setFormData({ ...formData, quantidade_kg: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supl">Suplemento / Aditivo</Label>
                <Input
                  id="supl"
                  placeholder="Ex: Sal proteinado 40%"
                  value={formData.suplemento}
                  onChange={(e) => setFormData({ ...formData, suplemento: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações do Trato</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Ex: Fornecido no cocho 2, boa aceitação pelo lote..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !formData.quantidade_kg}>
                {saving ? 'Registrando...' : 'Salvar Alimentação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
