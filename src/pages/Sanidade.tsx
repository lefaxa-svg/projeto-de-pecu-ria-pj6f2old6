import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Animal, Sanidade, TipoSanidade } from '@/types/pecuaria'
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
  Syringe,
  Plus,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Stethoscope,
  Clock,
  Search,
} from 'lucide-react'

export default function SanidadePage() {
  const { user } = useAuth()
  const [sanidades, setSanidades] = useState<Sanidade[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // New record modal
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    animal_id: '',
    data: new Date().toISOString().substring(0, 10),
    tipo: 'vacina' as TipoSanidade,
    descricao: '',
    produto: '',
    dose: '',
    proxima_dose: '',
    veterinario: '',
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [sanRes, animRes] = await Promise.all([
        pb.collection('sanidade').getFullList<Sanidade>({
          sort: '-data',
          expand: 'animal_id',
        }),
        pb.collection('animais').getFullList<Animal>({
          sort: 'brinco',
        }),
      ])
      setSanidades(sanRes)
      setAnimais(animRes)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    pb.collection('sanidade')
      .subscribe('*', () => loadData())
      .catch(() => {})
    return () => {
      pb.collection('sanidade')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [])

  // Stats
  const nowStr = new Date().toISOString().substring(0, 10)
  const vacinasCount = sanidades.filter((s) => s.tipo === 'vacina').length
  const tratamentosAtivos = sanidades.filter(
    (s) => s.tipo === 'medicamento' || s.tipo === 'cirurgia',
  ).length
  const ocorrenciasMes = sanidades.filter((s) => s.data.startsWith(nowStr.substring(0, 7))).length

  // Calendar pending vaccinations
  const upcomingVaccinations = sanidades
    .filter((s) => !!s.proxima_dose)
    .sort((a, b) => (a.proxima_dose || '').localeCompare(b.proxima_dose || ''))

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.animal_id || !formData.descricao) return
    setSaving(true)

    try {
      await pb.collection('sanidade').create({
        animal_id: formData.animal_id,
        data: formData.data,
        tipo: formData.tipo,
        descricao: formData.descricao.trim(),
        produto: formData.produto.trim() || null,
        dose: formData.dose.trim() || null,
        proxima_dose: formData.proxima_dose || null,
        veterinario: formData.veterinario.trim() || null,
        observacoes: formData.observacoes.trim() || null,
        dono_id: user.id,
      })

      toast({
        title: 'Registro Sanitário Criado',
        description: 'Manejo de saúde salvo com sucesso no prontuário do rebanho.',
      })

      setModalOpen(false)
      setFormData({
        animal_id: '',
        data: new Date().toISOString().substring(0, 10),
        tipo: 'vacina',
        descricao: '',
        produto: '',
        dose: '',
        proxima_dose: '',
        veterinario: '',
        observacoes: '',
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Falha no registro veterinário',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredRecords = sanidades.filter((s) => {
    const animal = s.expand?.animal_id
    const txt =
      `${animal?.brinco || ''} ${animal?.nome || ''} ${s.descricao} ${s.produto || ''} ${s.veterinario || ''}`.toLowerCase()
    return txt.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Syringe className="h-7 w-7 text-primary" />
            Sanidade & Prontuário Veterinário
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Calendário de vacinação obrigatória, controle de dosagens, vermífugos e tratamentos
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2 font-semibold shadow-xs">
          <Plus className="h-4 w-4" />
          Novo Registro Sanitário
        </Button>
      </div>

      {/* Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Vacinações no Histórico</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{vacinasCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Tratamentos / Medicamentos
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{tratamentosAtivos}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Stethoscope className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Ocorrências Este Mês</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{ocorrenciasMes}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Table + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of Health Records (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por animal, medicamento ou veterinário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium self-start sm:self-auto">
                <strong>{filteredRecords.length}</strong> registros encontrados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3">Animal</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Descrição / Produto</th>
                    <th className="px-4 py-3">Veterinário</th>
                    <th className="px-4 py-3 text-right">Próxima Dose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        Carregando registros sanitários...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        Nenhum registro sanitário encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item) => {
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
                          <td className="px-4 py-3.5 capitalize">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${
                                item.tipo === 'vacina'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : item.tipo === 'medicamento'
                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                    : item.tipo === 'cirurgia'
                                      ? 'bg-red-50 text-red-700 border-red-300'
                                      : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                              }`}
                            >
                              {item.tipo}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-foreground text-xs">
                              {item.descricao}
                            </p>
                            {item.produto && (
                              <p className="text-[11px] text-muted-foreground">
                                {item.produto} {item.dose ? `• Dose: ${item.dose}` : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {item.veterinario || 'Equipe da Fazenda'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-right whitespace-nowrap font-medium text-foreground">
                            {item.proxima_dose
                              ? new Date(item.proxima_dose).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Vaccination Calendar Side Panel (1 col) */}
        <div className="space-y-4">
          <Card className="border-border/70 shadow-xs">
            <div className="p-4 border-b border-border/70 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                Calendário de Vacinação e Reforços
              </h2>
            </div>
            <CardContent className="p-4 space-y-3">
              {upcomingVaccinations.length > 0 ? (
                upcomingVaccinations.map((s) => {
                  const isOverdue = s.proxima_dose && s.proxima_dose < nowStr
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                        isOverdue
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-amber-50/50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {s.expand?.animal_id?.brinco || 'Animal'} • {s.descricao}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            isOverdue
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }
                        >
                          {isOverdue ? 'Vencida' : 'Próxima'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Data prevista:{' '}
                          <strong className="text-foreground">
                            {new Date(s.proxima_dose!).toLocaleDateString('pt-BR')}
                          </strong>
                        </span>
                      </div>

                      {s.produto && <p className="text-muted-foreground">Produto: {s.produto}</p>}
                    </div>
                  )
                })
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  <p>Nenhuma dose futura ou vacinação pendente agendada.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Veterinary Guide Box */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-xs">
            <h3 className="font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Lembrete Sanitário Oficial
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Mantenha os comprovantes de Brucelose, Febre Aftosa e Clostridioses arquivados para
              emissão regular da GTA (Guia de Trânsito Animal).
            </p>
          </div>
        </div>
      </div>

      {/* New Sanidade Record Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-primary" />
              Registrar Manejo Sanitário
            </DialogTitle>
            <DialogDescription>
              Lance vacinas, vermífugos, antibióticos ou procedimentos cirúrgicos no animal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRecord} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Animal (Brinco) *</Label>
              <Select
                value={formData.animal_id}
                onValueChange={(val) => setFormData({ ...formData, animal_id: val })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o animal" />
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
                <Label>Tipo de Manejo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(val: TipoSanidade) => setFormData({ ...formData, tipo: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacina">Vacina</SelectItem>
                    <SelectItem value="medicamento">Medicamento / Vermífugo</SelectItem>
                    <SelectItem value="diagnostico">Diagnóstico / Exame</SelectItem>
                    <SelectItem value="cirurgia">Cirurgia / Procedimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data">Data da Aplicação *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição do Manejo *</Label>
              <Input
                id="desc"
                placeholder="Ex: Vacinação contra Febre Aftosa ou Tratamento de Mastite"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="produto">Produto Utilizado</Label>
                <Input
                  id="produto"
                  placeholder="Ex: Aftosa Bivalente / Ivermectina"
                  value={formData.produto}
                  onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dose">Dose Aplicada</Label>
                <Input
                  id="dose"
                  placeholder="Ex: 2 ml SC / 5 ml IM"
                  value={formData.dose}
                  onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proxima">Próxima Dose / Reforço</Label>
                <Input
                  id="proxima"
                  type="date"
                  value={formData.proxima_dose}
                  onChange={(e) => setFormData({ ...formData, proxima_dose: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vet">Veterinário / Aplicador</Label>
                <Input
                  id="vet"
                  placeholder="Ex: Dr. Carlos Mendes"
                  value={formData.veterinario}
                  onChange={(e) => setFormData({ ...formData, veterinario: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações / Reações</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Notas de carência, recomendações de descanso ou lote..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !formData.animal_id || !formData.descricao}>
                {saving ? 'Registrando...' : 'Salvar no Prontuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
