import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Animal, Reproducao, TipoReproducao, StatusReproducao } from '@/types/pecuaria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  HeartPulse,
  Plus,
  Baby,
  Activity,
  CheckCircle2,
  Calendar,
  Sparkles,
  Search,
} from 'lucide-react'

export default function ReproducaoPage() {
  const { user } = useAuth()
  const [reproducoes, setReproducoes] = useState<Reproducao[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [inseminacaoModalOpen, setInseminacaoModalOpen] = useState(false)
  const [checkPregnancyOpen, setCheckPregnancyOpen] = useState(false)
  const [birthModalOpen, setBirthModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Reproducao | null>(null)

  // Insemination Form
  const [insemForm, setInsemForm] = useState({
    animal_id: '',
    tipo: 'inseminacao' as TipoReproducao,
    data: new Date().toISOString().substring(0, 10),
    touro_semen: '',
    observacoes: '',
  })

  // Pregnancy check form
  const [pregStatus, setPregStatus] = useState<StatusReproducao>('prenha')
  const [pregObs, setPregObs] = useState('')

  // Birth Form
  const [birthForm, setBirthForm] = useState({
    brincoCria: '',
    nomeCria: '',
    sexoCria: 'femea' as 'macho' | 'femea',
    pesoCria: '35',
    dataParto: new Date().toISOString().substring(0, 10),
    racaCria: 'Nelore',
  })

  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [repRes, animRes] = await Promise.all([
        pb.collection('reproducao').getFullList<Reproducao>({
          sort: '-data',
          expand: 'animal_id',
        }),
        pb.collection('animais').getFullList<Animal>({
          sort: 'brinco',
        }),
      ])
      setReproducoes(repRes)
      setAnimais(animRes)
    } catch {
      // offline handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    pb.collection('reproducao')
      .subscribe('*', () => loadData())
      .catch(() => {})
    return () => {
      pb.collection('reproducao')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [])

  // Females available for breeding
  const matrizes = animais.filter((a) => a.sexo === 'femea')

  // Stats
  const prenhasCount = reproducoes.filter((r) => r.status === 'prenha').length
  const aguardandoCount = reproducoes.filter((r) => r.status === 'aguardando').length
  const nascidosCount = reproducoes.filter((r) => r.status === 'nascido').length
  const totalInsem = reproducoes.filter(
    (r) => r.tipo === 'inseminacao' || r.tipo === 'cobertura',
  ).length
  const conceptionRate = totalInsem > 0 ? Math.round((prenhasCount / totalInsem) * 100) : 0

  const handleSaveInseminacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !insemForm.animal_id) return
    setSaving(true)

    try {
      await pb.collection('reproducao').create({
        animal_id: insemForm.animal_id,
        tipo: insemForm.tipo,
        data: insemForm.data,
        touro_semen: insemForm.touro_semen,
        status: 'aguardando',
        observacoes: insemForm.observacoes,
        dono_id: user.id,
      })

      toast({
        title: 'Evento Reprodutivo Registrado',
        description: 'Lembrete de toque/ultrassom previsto para 30 a 45 dias.',
      })

      setInseminacaoModalOpen(false)
      setInsemForm({
        animal_id: '',
        tipo: 'inseminacao',
        data: new Date().toISOString().substring(0, 10),
        touro_semen: '',
        observacoes: '',
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Falha ao registrar reprodução',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSavePregnancyResult = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent) return
    setSaving(true)

    try {
      await pb.collection('reproducao').update(selectedEvent.id, {
        status: pregStatus,
        observacoes: pregObs
          ? `${selectedEvent.observacoes || ''} | DG: ${pregObs}`
          : selectedEvent.observacoes,
      })

      toast({
        title: 'Diagnóstico de Gestação Atualizado',
        description: `Resultado registrado como: ${pregStatus.toUpperCase()}`,
      })

      setCheckPregnancyOpen(false)
      setSelectedEvent(null)
      loadData()
    } catch {
      toast({
        title: 'Erro ao salvar diagnóstico',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRegisterBirth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent || !user) return
    setSaving(true)

    try {
      // 1. Create the new newborn calf in animais
      await pb.collection('animais').create({
        brinco: birthForm.brincoCria.trim(),
        nome: birthForm.nomeCria.trim() || undefined,
        categoria: 'bezerro',
        sexo: birthForm.sexoCria,
        raca: birthForm.racaCria,
        data_nascimento: birthForm.dataParto,
        peso_inicial: parseFloat(birthForm.pesoCria) || 35,
        status: 'ativo',
        observacoes: `Cria da matriz ${selectedEvent.expand?.animal_id?.brinco || ''} (Parto normal registrado).`,
        dono_id: user.id,
      })

      // 2. Mark the breeding event as nascido
      await pb.collection('reproducao').update(selectedEvent.id, {
        status: 'nascido',
        observacoes: `${selectedEvent.observacoes || ''} | Parto em ${birthForm.dataParto}. Cria brinco: ${birthForm.brincoCria}`,
      })

      toast({
        title: 'Parto e Bezerro Registrados!',
        description: `Bezerro(a) brinco ${birthForm.brincoCria} adicionado ao rebanho.`,
      })

      setBirthModalOpen(false)
      setSelectedEvent(null)
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao registrar parto',
        description: err instanceof Error ? err.message : 'Falha ao processar nascimento',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredReproducoes = reproducoes.filter((r) => {
    const animal = r.expand?.animal_id
    const txt = `${animal?.brinco || ''} ${animal?.nome || ''} ${r.touro_semen || ''}`.toLowerCase()
    return txt.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <HeartPulse className="h-7 w-7 text-primary" />
            Gestão Reprodutiva e IATF
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe coberturas, confirmação de prenhez, previsão de partos e nascimentos
          </p>
        </div>

        <Button
          onClick={() => setInseminacaoModalOpen(true)}
          className="gap-2 font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Nova Inseminação / Cobertura
        </Button>
      </div>

      {/* Stats Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Prenhezes Confirmadas</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{prenhasCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Aguardando Diagnóstico</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{aguardandoCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Partos / Nascidos</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{nascidosCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Baby className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Taxa de Concepção</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{conceptionRate}%</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por vaca, touro ou sêmen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium self-start sm:self-auto">
            Total de <strong>{filteredReproducoes.length}</strong> eventos registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">Matriz (Brinco/Nome)</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Touro / Sêmen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Próximo Passo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Carregando histórico reprodutivo...
                  </td>
                </tr>
              ) : filteredReproducoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhum registro de reprodução encontrado.
                  </td>
                </tr>
              ) : (
                filteredReproducoes.map((rep) => {
                  const animal = rep.expand?.animal_id
                  return (
                    <tr key={rep.id} className="hover:bg-muted/40 transition-colors">
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
                          <span className="text-muted-foreground italic">
                            Matriz ID {rep.animal_id}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 capitalize font-medium text-foreground">
                        {rep.tipo}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(rep.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5 text-foreground text-xs font-medium">
                        {rep.touro_semen || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={`capitalize text-[11px] ${
                            rep.status === 'prenha'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                              : rep.status === 'aguardando'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : rep.status === 'nascido'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                          }`}
                        >
                          {rep.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {rep.status === 'aguardando' && 'Diagnóstico Gestação (30d)'}
                        {rep.status === 'prenha' && 'Parto estimado (~280d)'}
                        {rep.status === 'nascido' && 'Desmame e vacinação'}
                        {rep.status === 'nao_prenha' && 'Reintroduzir em protocolo'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {rep.status === 'aguardando' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                              onClick={() => {
                                setSelectedEvent(rep)
                                setCheckPregnancyOpen(true)
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Registrar DG
                            </Button>
                          )}

                          {rep.status === 'prenha' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-semibold gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => {
                                setSelectedEvent(rep)
                                setBirthModalOpen(true)
                              }}
                            >
                              <Baby className="h-3.5 w-3.5" />
                              Registrar Parto
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Insemination Modal */}
      <Dialog open={inseminacaoModalOpen} onOpenChange={setInseminacaoModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />
              Nova Inseminação / Cobertura
            </DialogTitle>
            <DialogDescription>
              Lance o procedimento reprodutivo para acompanhamento de prenhez e ciclo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveInseminacao} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Matriz Fêmea *</Label>
              <Select
                value={insemForm.animal_id}
                onValueChange={(val) => setInsemForm({ ...insemForm, animal_id: val })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fêmea pelo brinco" />
                </SelectTrigger>
                <SelectContent>
                  {matrizes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.brinco} {m.nome ? `- ${m.nome}` : ''} ({m.raca})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Evento *</Label>
                <Select
                  value={insemForm.tipo}
                  onValueChange={(val: TipoReproducao) => setInsemForm({ ...insemForm, tipo: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inseminacao">Inseminação Artificial (IA / IATF)</SelectItem>
                    <SelectItem value="cobertura">Monta Natural / Cobertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data">Data do Procedimento *</Label>
                <Input
                  id="data"
                  type="date"
                  value={insemForm.data}
                  onChange={(e) => setInsemForm({ ...insemForm, data: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="touro">Touro / Sêmen / Partida</Label>
              <Input
                id="touro"
                placeholder="Ex: Touro Angus Absoluto 99"
                value={insemForm.touro_semen}
                onChange={(e) => setInsemForm({ ...insemForm, touro_semen: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações do Inseminador</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Ex: Protocolo D0 com implante de progesterona, muco límpido..."
                value={insemForm.observacoes}
                onChange={(e) => setInsemForm({ ...insemForm, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInseminacaoModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !insemForm.animal_id}>
                {saving ? 'Registrando...' : 'Confirmar Registro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pregnancy Check Flow Modal */}
      <Dialog open={checkPregnancyOpen} onOpenChange={setCheckPregnancyOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Diagnóstico de Gestação (DG)</DialogTitle>
            <DialogDescription>
              Confirme o resultado do toque retal ou ultrassonografia da matriz.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePregnancyResult} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Resultado do Exame *</Label>
              <Select
                value={pregStatus}
                onValueChange={(val: StatusReproducao) => setPregStatus(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prenha">Prenhez Confirmada (Positivo)</SelectItem>
                  <SelectItem value="nao_prenha">Vazia / Não Prenha (Negativo)</SelectItem>
                  <SelectItem value="aguardando">Aguardar Repetição de Exame</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pregObs">Anotações Veterinárias</Label>
              <Input
                id="pregObs"
                placeholder="Ex: Feto viável de ~40 dias, corpo lúteo no ovário direito"
                value={pregObs}
                onChange={(e) => setPregObs(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCheckPregnancyOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Gravando...' : 'Salvar Resultado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Birth Registration Modal */}
      <Dialog open={birthModalOpen} onOpenChange={setBirthModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-emerald-700" />
              Registro de Parto & Cria
            </DialogTitle>
            <DialogDescription>
              Cadastre o nascimento do bezerro originado desta prenhez.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterBirth} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brincoCria">Brinco do Bezerro *</Label>
                <Input
                  id="brincoCria"
                  placeholder="Ex: BR-601"
                  value={birthForm.brincoCria}
                  onChange={(e) => setBirthForm({ ...birthForm, brincoCria: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nomeCria">Nome / Apelido</Label>
                <Input
                  id="nomeCria"
                  placeholder="Ex: Campeiro"
                  value={birthForm.nomeCria}
                  onChange={(e) => setBirthForm({ ...birthForm, nomeCria: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sexo da Cria *</Label>
                <Select
                  value={birthForm.sexoCria}
                  onValueChange={(val: 'macho' | 'femea') =>
                    setBirthForm({ ...birthForm, sexoCria: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macho">Macho</SelectItem>
                    <SelectItem value="femea">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pesoCria">Peso ao Nascer (kg) *</Label>
                <Input
                  id="pesoCria"
                  type="number"
                  step="0.5"
                  value={birthForm.pesoCria}
                  onChange={(e) => setBirthForm({ ...birthForm, pesoCria: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataParto">Data do Parto *</Label>
              <Input
                id="dataParto"
                type="date"
                value={birthForm.dataParto}
                onChange={(e) => setBirthForm({ ...birthForm, dataParto: e.target.value })}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setBirthModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !birthForm.brincoCria}>
                {saving ? 'Registrando...' : 'Concluir Parto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
