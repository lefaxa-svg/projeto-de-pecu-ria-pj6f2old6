import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Animal, ProducaoLeite, TurnoProducao } from '@/types/pecuaria'
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
import { Milk, Plus, Sun, Moon, Search, Sparkles } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts'

export default function ProducaoPage() {
  const { user } = useAuth()
  const [producoes, setProducoes] = useState<ProducaoLeite[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    animal_id: '',
    data: new Date().toISOString().substring(0, 10),
    quantidade_litros: '',
    turno: 'manha' as TurnoProducao,
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [prodRes, animRes] = await Promise.all([
        pb.collection('producao_leite').getFullList<ProducaoLeite>({
          sort: '-data',
          expand: 'animal_id',
        }),
        pb.collection('animais').getFullList<Animal>({
          sort: 'brinco',
        }),
      ])
      setProducoes(prodRes)
      setAnimais(animRes)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    pb.collection('producao_leite')
      .subscribe('*', () => loadData())
      .catch(() => {})
    return () => {
      pb.collection('producao_leite')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [])

  // Only cows / females can produce milk
  const vacasLactantes = animais.filter((a) => a.categoria === 'vaca' || a.sexo === 'femea')

  const todayStr = new Date().toISOString().substring(0, 10)
  const currentMonthStr = todayStr.substring(0, 7)

  const producaoHoje = producoes
    .filter((p) => p.data === todayStr)
    .reduce((acc, cur) => acc + cur.quantidade_litros, 0)

  const producaoMes = producoes
    .filter((p) => p.data.startsWith(currentMonthStr))
    .reduce((acc, cur) => acc + cur.quantidade_litros, 0)

  const vacasAtivasCount = new Set(producoes.map((p) => p.animal_id)).size || vacasLactantes.length
  const mediaPorVaca = vacasAtivasCount > 0 ? (producaoHoje / vacasAtivasCount).toFixed(1) : '0.0'

  // Daily Chart for current month
  const dailyMap: Record<string, number> = {}
  producoes
    .filter((p) => p.data.startsWith(currentMonthStr))
    .forEach((p) => {
      const day = new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      dailyMap[day] = (dailyMap[day] || 0) + p.quantidade_litros
    })

  const chartData = Object.keys(dailyMap).map((k) => ({
    dia: k,
    litros: dailyMap[k],
  }))

  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.animal_id || !formData.quantidade_litros) return
    setSaving(true)

    try {
      await pb.collection('producao_leite').create({
        animal_id: formData.animal_id,
        data: formData.data,
        quantidade_litros: parseFloat(formData.quantidade_litros),
        turno: formData.turno,
        observacoes: formData.observacoes.trim() || null,
        dono_id: user.id,
      })

      toast({
        title: 'Produção Registrada',
        description: `${formData.quantidade_litros} Litros computados para a ordenha.`,
      })

      setModalOpen(false)
      setFormData({
        animal_id: '',
        data: new Date().toISOString().substring(0, 10),
        quantidade_litros: '',
        turno: 'manha',
        observacoes: '',
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao registrar ordenha',
        description: err instanceof Error ? err.message : 'Falha ao salvar dados de leite',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredProducoes = producoes.filter((p) => {
    const animal = p.expand?.animal_id
    const txt = `${animal?.brinco || ''} ${animal?.nome || ''} ${p.observacoes || ''}`.toLowerCase()
    return txt.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Milk className="h-7 w-7 text-primary" />
            Controle Leiteiro & Ordenha
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro diário de produção por turno (manhã/tarde), volume no tanque e médias
            individuais
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2 font-semibold shadow-xs">
          <Plus className="h-4 w-4" />
          Registrar Ordenha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              Produção Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{producaoHoje} L</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Tanque resfriador</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              Produção Acumulada Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{producaoMes} L</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total faturado no ciclo</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              Média por Vaca
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{mediaPorVaca} L/dia</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Eficiência por matriz</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              Vacas em Lactação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {vacasLactantes.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Matrizes ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Production Bar Chart */}
      <Card className="border-border/70 shadow-xs p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Produção Diária no Mês (Litros)</h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe a constância de volume coletado
            </p>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            Mês Atual
          </Badge>
        </div>

        <div className="h-[240px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E0D4" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(v) => [`${v} L`, 'Produção']} />
                <Bar dataKey="litros" fill="#2D5016" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma pesagem de leite registrada no mês atual.
            </div>
          )}
        </div>
      </Card>

      {/* Production Log Table */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por vaca ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium self-start sm:self-auto">
            Total de <strong>{filteredProducoes.length}</strong> ordenhas registradas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">Vaca (Brinco/Nome)</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3 font-semibold">Volume Coletado</th>
                <th className="px-4 py-3">Observações de Ordenha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Carregando produção...
                  </td>
                </tr>
              ) : filteredProducoes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhum registro de ordenha cadastrado.
                  </td>
                </tr>
              ) : (
                filteredProducoes.map((item) => {
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
                          'Animal ID ' + item.animal_id
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs flex items-center w-fit gap-1 ${
                            item.turno === 'manha'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          }`}
                        >
                          {item.turno === 'manha' ? (
                            <Sun className="h-3 w-3" />
                          ) : (
                            <Moon className="h-3 w-3" />
                          )}
                          {item.turno}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-foreground tabular-nums">
                        {item.quantidade_litros} L
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {item.observacoes || 'Ordenha normal sem grumos no teste da caneca'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Milk Production Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Milk className="h-5 w-5 text-primary" />
              Lançamento de Ordenha Leiteira
            </DialogTitle>
            <DialogDescription>
              Lance a quantidade coletada na ordenha mecânica ou manual.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduction} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Vaca / Matriz *</Label>
              <Select
                value={formData.animal_id}
                onValueChange={(val) => setFormData({ ...formData, animal_id: val })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a matriz em lactação" />
                </SelectTrigger>
                <SelectContent>
                  {vacasLactantes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.brinco} {a.nome ? `- ${a.nome}` : ''} ({a.raca})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data">Data da Ordenha *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Turno *</Label>
                <Select
                  value={formData.turno}
                  onValueChange={(val: TurnoProducao) => setFormData({ ...formData, turno: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (1ª Ordenha)</SelectItem>
                    <SelectItem value="tarde">Tarde (2ª Ordenha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="litros">Volume de Leite (Litros) *</Label>
              <Input
                id="litros"
                type="number"
                step="0.1"
                placeholder="Ex: 18.5"
                value={formData.quantidade_litros}
                onChange={(e) => setFormData({ ...formData, quantidade_litros: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações do Manejo</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Ex: Sanidade de úbere perfeita, CMT negativo, pós-dipping com iodo..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !formData.animal_id || !formData.quantidade_litros}
              >
                {saving ? 'Registrando...' : 'Gravar Ordenha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
