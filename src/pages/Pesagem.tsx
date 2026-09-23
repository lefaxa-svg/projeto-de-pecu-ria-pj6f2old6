import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Animal, Pesagem } from '@/types/pecuaria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Scale,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Search,
  Activity,
  LineChart as LineChartIcon,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts'

export default function PesagemPage() {
  const { user } = useAuth()
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Expandable row state for individual weight chart
  const [selectedAnimalForChart, setSelectedAnimalForChart] = useState<Animal | null>(null)
  const [individualHistory, setIndividualHistory] = useState<Pesagem[]>([])

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    animal_id: '',
    data: new Date().toISOString().substring(0, 10),
    peso: '',
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [pesRes, animRes] = await Promise.all([
        pb.collection('pesagens').getFullList<Pesagem>({
          sort: '-data',
          expand: 'animal_id',
        }),
        pb.collection('animais').getFullList<Animal>({
          sort: 'brinco',
        }),
      ])
      setPesagens(pesRes)
      setAnimais(animRes)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    pb.collection('pesagens')
      .subscribe('*', () => loadData())
      .catch(() => {})
    return () => {
      pb.collection('pesagens')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [])

  // Calculate gains per weighing
  // Group by animal sorted chronologically
  const animalHistoryMap: Record<string, Pesagem[]> = {}
  pesagens.forEach((p) => {
    if (!animalHistoryMap[p.animal_id]) animalHistoryMap[p.animal_id] = []
    animalHistoryMap[p.animal_id].push(p)
  })

  // Sort each animal's weighings chronologically
  Object.keys(animalHistoryMap).forEach((id) => {
    animalHistoryMap[id].sort((a, b) => a.data.localeCompare(b.data))
  })

  const getWeightGain = (p: Pesagem) => {
    const list = animalHistoryMap[p.animal_id] || []
    const idx = list.findIndex((item) => item.id === p.id)
    if (idx > 0) {
      const prev = list[idx - 1]
      return p.peso - prev.peso
    }
    // compare with initial weight if available
    const animal = p.expand?.animal_id
    if (animal && animal.peso_inicial) {
      return p.peso - animal.peso_inicial
    }
    return 0
  }

  // Summary stats
  const totalPesagens = pesagens.length
  const avgWeight =
    totalPesagens > 0
      ? Math.round(pesagens.reduce((acc, cur) => acc + cur.peso, 0) / totalPesagens)
      : 0
  const lastWeighingDate = pesagens.length > 0 ? pesagens[0].data : null

  const handleSelectAnimalChart = async (animal: Animal) => {
    if (selectedAnimalForChart?.id === animal.id) {
      setSelectedAnimalForChart(null)
      setIndividualHistory([])
      return
    }
    setSelectedAnimalForChart(animal)
    const list = animalHistoryMap[animal.id] || []
    setIndividualHistory(list)
  }

  const handleSaveWeighing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.animal_id || !formData.peso) return
    setSaving(true)

    try {
      await pb.collection('pesagens').create({
        animal_id: formData.animal_id,
        data: formData.data,
        peso: parseFloat(formData.peso),
        observacoes: formData.observacoes.trim() || null,
        dono_id: user.id,
      })

      toast({
        title: 'Pesagem Registrada',
        description: `Peso de ${formData.peso} kg salvo com cálculo de GMD.`,
      })

      setModalOpen(false)
      setFormData({
        animal_id: '',
        data: new Date().toISOString().substring(0, 10),
        peso: '',
        observacoes: '',
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao registrar pesagem',
        description: err instanceof Error ? err.message : 'Falha na gravação dos dados',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredPesagens = pesagens.filter((p) => {
    const animal = p.expand?.animal_id
    const txt = `${animal?.brinco || ''} ${animal?.nome || ''} ${p.observacoes || ''}`.toLowerCase()
    return txt.includes(search.toLowerCase())
  })

  const individualChartData = individualHistory.map((p) => ({
    data: new Date(p.data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
    peso: p.peso,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Scale className="h-7 w-7 text-primary" />
            Pesagens & Ganho Médio Diário (GMD)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe a curva de desenvolvimento ponderal e eficiência de engorda do rebanho
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2 font-semibold shadow-xs">
          <Plus className="h-4 w-4" />
          Nova Pesagem
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Peso Médio Registrado</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{avgWeight} kg</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Scale className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Última Pesagem no Rebanho
              </p>
              <p className="text-2xl font-bold text-foreground">
                {lastWeighingDate ? new Date(lastWeighingDate).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Total de Pesagens Feitas
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{totalPesagens}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expandable Chart Banner if animal selected */}
      {selectedAnimalForChart && (
        <Card className="border-primary/40 shadow-sm bg-card p-5 animate-slide-down">
          <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
            <div className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Curva de Peso: Brinco {selectedAnimalForChart.brinco}{' '}
                {selectedAnimalForChart.nome && `(${selectedAnimalForChart.nome})`}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAnimalForChart(null)}
              className="text-xs text-muted-foreground"
            >
              Fechar Gráfico
            </Button>
          </div>

          <div className="h-[220px] w-full">
            {individualChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={individualChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E0D4" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 20', 'dataMax + 20']} />
                  <RechartsTooltip formatter={(v) => [`${v} kg`, 'Peso']} />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#2D5016"
                    strokeWidth={2.5}
                    dot={{ fill: '#2D5016', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Poucos dados para formar curva deste animal.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Weighings Table */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por brinco ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium self-start sm:self-auto">
            Clique na linha para visualizar a curva de evolução individual do animal
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">Animal</th>
                <th className="px-4 py-3">Data da Pesagem</th>
                <th className="px-4 py-3 font-semibold">Peso (kg)</th>
                <th className="px-4 py-3">Ganho / Perda</th>
                <th className="px-4 py-3">Observações de Manejo</th>
                <th className="px-4 py-3 text-right">Evolução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Carregando pesagens...
                  </td>
                </tr>
              ) : filteredPesagens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhuma pesagem encontrada.
                  </td>
                </tr>
              ) : (
                filteredPesagens.map((p) => {
                  const animal = p.expand?.animal_id
                  const gain = getWeightGain(p)
                  const isPositive = gain > 0
                  const isNegative = gain < 0

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => animal && handleSelectAnimalChart(animal)}
                    >
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
                          'Animal ID ' + p.animal_id
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-foreground tabular-nums">
                        {p.peso} kg
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold tabular-nums">
                        {gain === 0 ? (
                          <span className="text-muted-foreground">0 kg (Estável)</span>
                        ) : isPositive ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" />+{gain} kg
                          </span>
                        ) : (
                          <span className="text-red-700 flex items-center gap-1">
                            <TrendingDown className="h-3.5 w-3.5" />
                            {gain} kg
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {p.observacoes || 'Pesagem de rotina no brete'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (animal) handleSelectAnimalChart(animal)
                          }}
                        >
                          <LineChartIcon className="h-3.5 w-3.5 mr-1" />
                          Curva
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Weighing Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Lançamento de Pesagem no Brete
            </DialogTitle>
            <DialogDescription>
              O sistema calcula automaticamente o ganho de peso em relação à pesagem anterior.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWeighing} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Animal (Brinco) *</Label>
              <Select
                value={formData.animal_id}
                onValueChange={(val) => setFormData({ ...formData, animal_id: val })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o animal pesado" />
                </SelectTrigger>
                <SelectContent>
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
                <Label htmlFor="data">Data da Pesagem *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="peso">Peso Balança (kg) *</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.5"
                  placeholder="Ex: 485"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações do Manejo</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Ex: Animal em jejum, lote de terminação em confinamento..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !formData.animal_id || !formData.peso}>
                {saving ? 'Registrando...' : 'Gravar Pesagem'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
