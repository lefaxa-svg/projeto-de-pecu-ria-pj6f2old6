import React, { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Animal,
  Pesagem,
  Reproducao,
  Sanidade,
  CategoriaAnimal,
  SexoAnimal,
  RacaAnimal,
  StatusAnimal,
} from '@/types/pecuaria'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/hooks/use-toast'
import {
  Beef,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Scale,
  Calendar,
  HeartPulse,
  Syringe,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag,
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

const RACAS: RacaAnimal[] = ['Nelore', 'Angus', 'Brahman', 'Guzerá', 'Simental', 'Cruzado', 'Outra']
const CATEGORIAS: { label: string; value: CategoriaAnimal }[] = [
  { label: 'Bezerro(a)', value: 'bezerro' },
  { label: 'Novilha', value: 'novilha' },
  { label: 'Novilho', value: 'novilho' },
  { label: 'Vaca', value: 'vaca' },
  { label: 'Touro', value: 'touro' },
]

export default function Animais() {
  const { user } = useAuth()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & sorting
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')
  const [sexoFilter, setSexoFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [racaFilter, setRacaFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('brinco')
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null)
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null)

  // Sub-records for detail view
  const [animalPesagens, setAnimalPesagens] = useState<Pesagem[]>([])
  const [animalSanidades, setAnimalSanidades] = useState<Sanidade[]>([])
  const [animalReproducoes, setAnimalReproducoes] = useState<Reproducao[]>([])

  // Form state
  const [formData, setFormData] = useState({
    brinco: '',
    nome: '',
    categoria: 'bezerro' as CategoriaAnimal,
    sexo: 'femea' as SexoAnimal,
    raca: 'Nelore' as RacaAnimal,
    data_nascimento: '',
    peso_inicial: '',
    status: 'ativo' as StatusAnimal,
    observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  const loadAnimais = async () => {
    try {
      const records = await pb.collection('animais').getFullList<Animal>({
        sort: '-created',
      })
      setAnimais(records)
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnimais()

    // Realtime sync
    pb.collection('animais')
      .subscribe('*', () => {
        loadAnimais()
      })
      .catch(() => {})

    return () => {
      pb.collection('animais')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [])

  // Filtered and sorted animals
  const filteredAnimais = useMemo(() => {
    return animais
      .filter((a) => {
        const matchesSearch =
          (a.brinco || '').toLowerCase().includes(search.toLowerCase()) ||
          (a.nome || '').toLowerCase().includes(search.toLowerCase())
        const matchesCat = categoriaFilter === 'all' || a.categoria === categoriaFilter
        const matchesSexo = sexoFilter === 'all' || a.sexo === sexoFilter
        const matchesStatus = statusFilter === 'all' || a.status === statusFilter
        const matchesRaca = racaFilter === 'all' || a.raca === racaFilter

        return matchesSearch && matchesCat && matchesSexo && matchesStatus && matchesRaca
      })
      .sort((a, b) => {
        if (sortBy === 'brinco') return (a.brinco || '').localeCompare(b.brinco || '')
        if (sortBy === 'nome') return (a.nome || '').localeCompare(b.nome || '')
        if (sortBy === 'data_nascimento')
          return (a.data_nascimento || '').localeCompare(b.data_nascimento || '')
        if (sortBy === 'peso') return (b.peso_inicial || 0) - (a.peso_inicial || 0)
        return 0
      })
  }, [animais, search, categoriaFilter, sexoFilter, statusFilter, racaFilter, sortBy])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAnimais.length / pageSize))
  const paginatedAnimais = filteredAnimais.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  // Stats summary
  const totalCount = animais.length
  const machosCount = animais.filter((a) => a.sexo === 'macho').length
  const femeasCount = animais.filter((a) => a.sexo === 'femea').length
  const bezerrosCount = animais.filter((a) => a.categoria === 'bezerro').length

  const handleOpenCreate = (animalToEdit?: Animal) => {
    if (animalToEdit) {
      setEditingAnimal(animalToEdit)
      setFormData({
        brinco: animalToEdit.brinco,
        nome: animalToEdit.nome || '',
        categoria: animalToEdit.categoria,
        sexo: animalToEdit.sexo,
        raca: animalToEdit.raca,
        data_nascimento: animalToEdit.data_nascimento
          ? animalToEdit.data_nascimento.substring(0, 10)
          : '',
        peso_inicial: animalToEdit.peso_inicial ? String(animalToEdit.peso_inicial) : '',
        status: animalToEdit.status,
        observacoes: animalToEdit.observacoes || '',
      })
    } else {
      setEditingAnimal(null)
      setFormData({
        brinco: '',
        nome: '',
        categoria: 'bezerro',
        sexo: 'femea',
        raca: 'Nelore',
        data_nascimento: new Date().toISOString().substring(0, 10),
        peso_inicial: '45',
        status: 'ativo',
        observacoes: '',
      })
    }
    setCreateModalOpen(true)
  }

  const handleSaveAnimal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    try {
      const payload = {
        brinco: formData.brinco.trim(),
        nome: formData.nome.trim(),
        categoria: formData.categoria,
        sexo: formData.sexo,
        raca: formData.raca,
        data_nascimento: formData.data_nascimento || null,
        peso_inicial: formData.peso_inicial ? parseFloat(formData.peso_inicial) : null,
        status: formData.status,
        observacoes: formData.observacoes.trim(),
        dono_id: user.id,
      }

      if (editingAnimal) {
        await pb.collection('animais').update(editingAnimal.id, payload)
        toast({ title: 'Animal atualizado', description: `O brinco ${payload.brinco} foi salvo.` })
      } else {
        await pb.collection('animais').create(payload)
        toast({
          title: 'Animal cadastrado',
          description: `Brinco ${payload.brinco} adicionado ao rebanho.`,
        })
      }

      setCreateModalOpen(false)
      loadAnimais()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar animal.'
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAnimal = async () => {
    if (!selectedAnimal) return
    try {
      await pb.collection('animais').delete(selectedAnimal.id)
      toast({
        title: 'Animal excluído',
        description: `Brinco ${selectedAnimal.brinco} foi removido com sucesso.`,
      })
      setDeleteConfirmOpen(false)
      setSelectedAnimal(null)
      loadAnimais()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o animal.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenDetail = async (animal: Animal) => {
    setSelectedAnimal(animal)
    setDetailModalOpen(true)
    try {
      const [pes, san, rep] = await Promise.all([
        pb
          .collection('pesagens')
          .getFullList<Pesagem>({ filter: `animal_id='${animal.id}'`, sort: 'data' }),
        pb
          .collection('sanidade')
          .getFullList<Sanidade>({ filter: `animal_id='${animal.id}'`, sort: '-data' }),
        pb
          .collection('reproducao')
          .getFullList<Reproducao>({ filter: `animal_id='${animal.id}'`, sort: '-data' }),
      ])
      setAnimalPesagens(pes)
      setAnimalSanidades(san)
      setAnimalReproducoes(rep)
    } catch {
      // ignore
    }
  }

  const weightHistoryChartData = animalPesagens.map((p) => ({
    data: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    peso: p.peso,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Beef className="h-7 w-7 text-primary" />
            Rebanho de Animais
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerenciamento individual com identificação por brinco, linhagem e pesagem
          </p>
        </div>

        <Button onClick={() => handleOpenCreate()} className="gap-2 font-semibold shadow-xs">
          <Plus className="h-4 w-4" />
          Novo Animal
        </Button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Total Cadastrado</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{totalCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Beef className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Machos</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{machosCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center">
              <span className="font-bold text-sm">♂</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Fêmeas</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{femeasCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-pink-500/10 text-pink-700 flex items-center justify-center">
              <span className="font-bold text-sm">♀</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Bezerros(as)</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{bezerrosCount}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Beef className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/70 shadow-xs p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por brinco ou nome do animal..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select
              value={categoriaFilter}
              onValueChange={(val) => {
                setCategoriaFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                <SelectItem value="bezerro">Bezerro</SelectItem>
                <SelectItem value="novilha">Novilha</SelectItem>
                <SelectItem value="novilho">Novilho</SelectItem>
                <SelectItem value="vaca">Vaca</SelectItem>
                <SelectItem value="touro">Touro</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sexoFilter}
              onValueChange={(val) => {
                setSexoFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Sexos</SelectItem>
                <SelectItem value="macho">Macho</SelectItem>
                <SelectItem value="femea">Fêmea</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="vendido">Vendido</SelectItem>
                <SelectItem value="obito">Óbito</SelectItem>
                <SelectItem value="descarte">Descarte</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={racaFilter}
              onValueChange={(val) => {
                setRacaFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Raça" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Raças</SelectItem>
                {RACAS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/50">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" />
            <span>
              Exibindo <strong>{filteredAnimais.length}</strong> de{' '}
              <strong>{animais.length}</strong> animais
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>Ordenar:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-7 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brinco">Brinco</SelectItem>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="data_nascimento">Nascimento</SelectItem>
                <SelectItem value="peso">Peso Inicial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">Brinco / Identificador</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-center">Sexo</th>
                <th className="px-4 py-3">Raça</th>
                <th className="px-4 py-3">Nascimento</th>
                <th className="px-4 py-3">Peso Inicial</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Carregando rebanho...
                  </td>
                </tr>
              ) : paginatedAnimais.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhum animal encontrado para estes filtros.
                  </td>
                </tr>
              ) : (
                paginatedAnimais.map((animal) => (
                  <tr
                    key={animal.id}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => handleOpenDetail(animal)}
                  >
                    <td className="px-4 py-3.5 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span>{animal.brinco}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-foreground font-medium">
                      {animal.nome || '—'}
                    </td>
                    <td className="px-4 py-3.5 capitalize text-foreground">{animal.categoria}</td>
                    <td className="px-4 py-3.5 text-center">
                      {animal.sexo === 'macho' ? (
                        <span
                          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold"
                          title="Macho"
                        >
                          ♂
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-pink-100 text-pink-700 text-xs font-bold"
                          title="Fêmea"
                        >
                          ♀
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{animal.raca}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                      {animal.data_nascimento
                        ? new Date(animal.data_nascimento).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums text-foreground">
                      {animal.peso_inicial ? `${animal.peso_inicial} kg` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant="outline"
                        className={`capitalize text-[11px] ${
                          animal.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : animal.status === 'vendido'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : animal.status === 'obito'
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                        }`}
                      >
                        {animal.status}
                      </Badge>
                    </td>
                    <td
                      className="px-4 py-3.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenDetail(animal)}
                          title="Ver Ficha Completa"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenCreate(animal)}
                          title="Editar Animal"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSelectedAnimal(animal)
                            setDeleteConfirmOpen(true)
                          }}
                          title="Excluir Animal"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border/70 bg-card text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Linhas por página:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Creation / Edit Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beef className="h-5 w-5 text-primary" />
              {editingAnimal
                ? `Editar Animal - Brinco ${editingAnimal.brinco}`
                : 'Novo Animal no Rebanho'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados biométricos e genealógicos do animal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAnimal} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brinco">Brinco / Tag *</Label>
                <Input
                  id="brinco"
                  placeholder="Ex: BR-100"
                  value={formData.brinco}
                  onChange={(e) => setFormData({ ...formData, brinco: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome / Apelido</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Estrela, Barão"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val: CategoriaAnimal) =>
                    setFormData({ ...formData, categoria: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Raça *</Label>
                <Select
                  value={formData.raca}
                  onValueChange={(val: RacaAnimal) => setFormData({ ...formData, raca: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RACAS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Sexo *</Label>
              <RadioGroup
                value={formData.sexo}
                onValueChange={(val: SexoAnimal) => setFormData({ ...formData, sexo: val })}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="femea" id="femea" />
                  <Label htmlFor="femea" className="cursor-pointer font-normal">
                    Fêmea
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="macho" id="macho" />
                  <Label htmlFor="macho" className="cursor-pointer font-normal">
                    Macho
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data_nasc">Data de Nascimento</Label>
                <Input
                  id="data_nasc"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="peso_inicial">Peso Inicial (kg)</Label>
                <Input
                  id="peso_inicial"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 120"
                  value={formData.peso_inicial}
                  onChange={(e) => setFormData({ ...formData, peso_inicial: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status do Animal *</Label>
              <Select
                value={formData.status}
                onValueChange={(val: StatusAnimal) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo na Propriedade</SelectItem>
                  <SelectItem value="vendido">Comercializado / Vendido</SelectItem>
                  <SelectItem value="obito">Óbito</SelectItem>
                  <SelectItem value="descarte">Descarte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações Gerais</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Detalhes de pelagem, temperamento, procedência ou histórico..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingAnimal ? 'Salvar Alterações' : 'Cadastrar Animal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Animal Detail Modal with Tabs */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {selectedAnimal && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Beef className="h-6 w-6 text-primary" />
                    Brinco: {selectedAnimal.brinco}
                    {selectedAnimal.nome && (
                      <span className="text-muted-foreground font-normal">
                        ({selectedAnimal.nome})
                      </span>
                    )}
                  </DialogTitle>
                  <Badge className="capitalize">{selectedAnimal.status}</Badge>
                </div>
                <DialogDescription>
                  Ficha zootécnica detalhada, histórico ponderal, reprodutivo e sanitário.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="perfil" className="w-full mt-2">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="perfil">Perfil</TabsTrigger>
                  <TabsTrigger value="pesagens">Pesagens ({animalPesagens.length})</TabsTrigger>
                  <TabsTrigger value="sanidade">Sanidade ({animalSanidades.length})</TabsTrigger>
                  <TabsTrigger value="reproducao">
                    Reprodução ({animalReproducoes.length})
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Perfil */}
                <TabsContent value="perfil" className="space-y-4 pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/40 p-4 rounded-xl border border-border/70 text-xs">
                    <div>
                      <span className="text-muted-foreground">Categoria:</span>
                      <p className="font-semibold text-foreground text-sm capitalize">
                        {selectedAnimal.categoria}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sexo:</span>
                      <p className="font-semibold text-foreground text-sm capitalize">
                        {selectedAnimal.sexo}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Raça:</span>
                      <p className="font-semibold text-foreground text-sm">{selectedAnimal.raca}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Nascimento:</span>
                      <p className="font-semibold text-foreground text-sm">
                        {selectedAnimal.data_nascimento
                          ? new Date(selectedAnimal.data_nascimento).toLocaleDateString('pt-BR')
                          : 'Não informada'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Peso Inicial:</span>
                      <p className="font-semibold text-foreground text-sm">
                        {selectedAnimal.peso_inicial ? `${selectedAnimal.peso_inicial} kg` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cadastrado em:</span>
                      <p className="font-semibold text-foreground text-sm">
                        {new Date(selectedAnimal.created).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {selectedAnimal.observacoes && (
                    <div className="p-3 bg-card rounded-lg border border-border/60 text-xs space-y-1">
                      <span className="font-semibold text-foreground">Notas e Observações:</span>
                      <p className="text-muted-foreground">{selectedAnimal.observacoes}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailModalOpen(false)
                        handleOpenCreate(selectedAnimal)
                      }}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Editar Ficha
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab: Pesagens */}
                <TabsContent value="pesagens" className="space-y-4 pt-3">
                  {weightHistoryChartData.length > 1 && (
                    <div className="h-[200px] w-full p-2 bg-muted/30 rounded-xl border border-border/60">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={weightHistoryChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E0D4" />
                          <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            domain={['dataMin - 10', 'dataMax + 10']}
                          />
                          <RechartsTooltip formatter={(v) => [`${v} kg`, 'Peso']} />
                          <Line
                            type="monotone"
                            dataKey="peso"
                            stroke="#2D5016"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {animalPesagens.length > 0 ? (
                    <div className="space-y-2">
                      {animalPesagens.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-card text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-primary" />
                            <div>
                              <p className="font-bold text-foreground">{p.peso} kg</p>
                              <p className="text-muted-foreground">
                                {p.observacoes || 'Pesagem regular'}
                              </p>
                            </div>
                          </div>
                          <span className="text-muted-foreground font-medium">
                            {new Date(p.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-center py-6 text-muted-foreground">
                      Nenhuma pesagem lançada para este animal ainda.
                    </p>
                  )}
                </TabsContent>

                {/* Tab: Sanidade */}
                <TabsContent value="sanidade" className="space-y-3 pt-3">
                  {animalSanidades.length > 0 ? (
                    animalSanidades.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border border-border/60 bg-card text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground capitalize flex items-center gap-1.5">
                            <Syringe className="h-3.5 w-3.5 text-primary" />
                            {s.tipo}: {s.descricao}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(s.data).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {s.produto && (
                          <p className="text-muted-foreground">
                            Produto: <strong className="text-foreground">{s.produto}</strong>{' '}
                            {s.dose ? `(${s.dose})` : ''}
                          </p>
                        )}
                        {s.veterinario && (
                          <p className="text-muted-foreground">Profissional: {s.veterinario}</p>
                        )}
                        {s.proxima_dose && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 mt-1"
                          >
                            Próxima dose: {new Date(s.proxima_dose).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center py-6 text-muted-foreground">
                      Nenhum registro sanitário associado a este animal.
                    </p>
                  )}
                </TabsContent>

                {/* Tab: Reprodução */}
                <TabsContent value="reproducao" className="space-y-3 pt-3">
                  {animalReproducoes.length > 0 ? (
                    animalReproducoes.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-lg border border-border/60 bg-card text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground capitalize flex items-center gap-1.5">
                            <HeartPulse className="h-3.5 w-3.5 text-primary" />
                            {r.tipo}
                          </span>
                          <Badge className="capitalize text-[10px]">{r.status}</Badge>
                        </div>
                        <p className="text-muted-foreground">
                          Data: {new Date(r.data).toLocaleDateString('pt-BR')}
                        </p>
                        {r.touro_semen && (
                          <p className="text-muted-foreground">
                            Touro / Sêmen:{' '}
                            <strong className="text-foreground">{r.touro_semen}</strong>
                          </p>
                        )}
                        {r.observacoes && (
                          <p className="text-muted-foreground italic">"{r.observacoes}"</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center py-6 text-muted-foreground">
                      Nenhum histórico reprodutivo registrado.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o animal com brinco <strong>{selectedAnimal?.brinco}</strong>{' '}
              {selectedAnimal?.nome && `(${selectedAnimal?.nome})`} e todo o seu histórico de
              pesagens, sanidade e reprodução associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAnimal}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
