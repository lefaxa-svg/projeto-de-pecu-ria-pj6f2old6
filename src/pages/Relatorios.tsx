import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import type { Animal, Pesagem, Reproducao, Sanidade, ProducaoLeite } from '@/types/pecuaria'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  FileBarChart,
  Printer,
  Download,
  Beef,
  HeartPulse,
  Syringe,
  Milk,
  Scale,
  Calendar,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts'

type ReportType = 'rebanho' | 'reproducao' | 'sanidade' | 'producao' | 'pesagem'

export default function RelatoriosPage() {
  const [period, setPeriod] = useState<string>('mes')
  const [activeReportModal, setActiveReportModal] = useState<ReportType | null>(null)

  const [animais, setAnimais] = useState<Animal[]>([])
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [reproducoes, setReproducoes] = useState<Reproducao[]>([])
  const [sanidades, setSanidades] = useState<Sanidade[]>([])
  const [producoes, setProducoes] = useState<ProducaoLeite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [a, p, r, s, pl] = await Promise.all([
          pb.collection('animais').getFullList<Animal>(),
          pb.collection('pesagens').getFullList<Pesagem>({ expand: 'animal_id', sort: '-data' }),
          pb
            .collection('reproducao')
            .getFullList<Reproducao>({ expand: 'animal_id', sort: '-data' }),
          pb.collection('sanidade').getFullList<Sanidade>({ expand: 'animal_id', sort: '-data' }),
          pb
            .collection('producao_leite')
            .getFullList<ProducaoLeite>({ expand: 'animal_id', sort: '-data' }),
        ])
        setAnimais(a)
        setPesagens(p)
        setReproducoes(r)
        setSanidades(s)
        setProducoes(pl)
      } catch {
        // offline
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // Export CSV Helper
  const exportToCSV = (data: Array<Record<string, unknown>>, filename: string) => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(';')]
        .concat(
          data.map((row) =>
            headers
              .map((fieldName) => {
                const val = row[fieldName]
                return `"${String(val ?? '').replace(/"/g, '""')}"`
              })
              .join(';'),
          ),
        )
        .join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  // Summary Metrics
  const totalAnimais = animais.length
  const prenhasCount = reproducoes.filter((r) => r.status === 'prenha').length
  const totalLeite = producoes.reduce((acc, cur) => acc + cur.quantidade_litros, 0)
  const totalVacinas = sanidades.filter((s) => s.tipo === 'vacina').length
  const mediaPeso =
    pesagens.length > 0
      ? Math.round(pesagens.reduce((acc, cur) => acc + cur.peso, 0) / pesagens.length)
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileBarChart className="h-7 w-7 text-primary" />
            Central de Relatórios & Indicadores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Consolidação gerencial, conformidade sanitária, índices zootécnicos e exportação de
            dados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Este Trimestre</SelectItem>
              <SelectItem value="ano">Ano Corrente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Relatório 1: Rebanho */}
        <Card className="border-border/70 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between">
          <CardHeader>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Beef className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-bold">Relatório Geral de Rebanho</CardTitle>
            <CardDescription className="text-xs">
              Censo populacional por categoria, sexo, raça e status zootécnico ativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animais Cadastrados:</span>
                <span className="font-bold text-foreground">{totalAnimais}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matrizes / Vacas:</span>
                <span className="font-bold text-foreground">
                  {animais.filter((a) => a.categoria === 'vaca').length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => setActiveReportModal('rebanho')}
              >
                Abrir Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2.5"
                onClick={() =>
                  exportToCSV(
                    animais.map((a) => ({
                      Brinco: a.brinco,
                      Nome: a.nome,
                      Categoria: a.categoria,
                      Sexo: a.sexo,
                      Raca: a.raca,
                      Nascimento: a.data_nascimento,
                      PesoInicial: a.peso_inicial,
                      Status: a.status,
                    })),
                    'relatorio_rebanho',
                  )
                }
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório 2: Reprodução */}
        <Card className="border-border/70 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between">
          <CardHeader>
            <div className="h-10 w-10 rounded-xl bg-pink-500/10 text-pink-700 flex items-center justify-center mb-2">
              <HeartPulse className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-bold">Relatório Reprodutivo & IATF</CardTitle>
            <CardDescription className="text-xs">
              Taxa de concepção, diagnóstico gestacional, partos e linhagem dos touros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prenhezes Confirmadas:</span>
                <span className="font-bold text-foreground">{prenhasCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Inseminações:</span>
                <span className="font-bold text-foreground">{reproducoes.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => setActiveReportModal('reproducao')}
              >
                Abrir Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2.5"
                onClick={() =>
                  exportToCSV(
                    reproducoes.map((r) => ({
                      MatrizID: r.animal_id,
                      Brinco: r.expand?.animal_id?.brinco,
                      Tipo: r.tipo,
                      Data: r.data,
                      TouroSemen: r.touro_semen,
                      Status: r.status,
                      Observacoes: r.observacoes,
                    })),
                    'relatorio_reproducao',
                  )
                }
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório 3: Sanitário */}
        <Card className="border-border/70 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between">
          <CardHeader>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-2">
              <Syringe className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-bold">Relatório Sanitário & Vacinal</CardTitle>
            <CardDescription className="text-xs">
              Histórico de campanhas sanitárias, medicamentos e controle de reforços.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vacinações no Histórico:</span>
                <span className="font-bold text-foreground">{totalVacinas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Procedimentos:</span>
                <span className="font-bold text-foreground">{sanidades.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => setActiveReportModal('sanidade')}
              >
                Abrir Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2.5"
                onClick={() =>
                  exportToCSV(
                    sanidades.map((s) => ({
                      Brinco: s.expand?.animal_id?.brinco,
                      Data: s.data,
                      Tipo: s.tipo,
                      Descricao: s.descricao,
                      Produto: s.produto,
                      Dose: s.dose,
                      ProximaDose: s.proxima_dose,
                      Veterinario: s.veterinario,
                    })),
                    'relatorio_sanitario',
                  )
                }
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório 4: Produção de Leite */}
        <Card className="border-border/70 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between">
          <CardHeader>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center mb-2">
              <Milk className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-bold">Relatório de Produção Leiteira</CardTitle>
            <CardDescription className="text-xs">
              Volume total coletado, médias por vaca e comparativos entre turnos de ordenha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Litros Acumulados:</span>
                <span className="font-bold text-foreground">{totalLeite} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ordenhas Registradas:</span>
                <span className="font-bold text-foreground">{producoes.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => setActiveReportModal('producao')}
              >
                Abrir Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2.5"
                onClick={() =>
                  exportToCSV(
                    producoes.map((pl) => ({
                      Brinco: pl.expand?.animal_id?.brinco,
                      Data: pl.data,
                      Litros: pl.quantidade_litros,
                      Turno: pl.turno,
                      Observacoes: pl.observacoes,
                    })),
                    'relatorio_producao_leite',
                  )
                }
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório 5: Pesagem & GMD */}
        <Card className="border-border/70 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between">
          <CardHeader>
            <div className="h-10 w-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center mb-2">
              <Scale className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-bold">Relatório de Pesagens & GMD</CardTitle>
            <CardDescription className="text-xs">
              Ganhos de peso corporal, curvas de crescimento e desempenho no confinamento/pasto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Média do Rebanho:</span>
                <span className="font-bold text-foreground">{mediaPeso} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pesagens no Sistema:</span>
                <span className="font-bold text-foreground">{pesagens.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => setActiveReportModal('pesagem')}
              >
                Abrir Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2.5"
                onClick={() =>
                  exportToCSV(
                    pesagens.map((p) => ({
                      Brinco: p.expand?.animal_id?.brinco,
                      Data: p.data,
                      Peso: p.peso,
                      Observacoes: p.observacoes,
                    })),
                    'relatorio_pesagens',
                  )
                }
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Modal View */}
      <Dialog open={activeReportModal !== null} onOpenChange={() => setActiveReportModal(null)}>
        <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  {activeReportModal === 'rebanho' && 'Detalhamento: Censo do Rebanho'}
                  {activeReportModal === 'reproducao' && 'Detalhamento: Eventos Reprodutivos'}
                  {activeReportModal === 'sanidade' && 'Detalhamento: Histórico Sanitário'}
                  {activeReportModal === 'producao' && 'Detalhamento: Produção Leiteira'}
                  {activeReportModal === 'pesagem' && 'Detalhamento: Curva e Pesagens'}
                </DialogTitle>
                <DialogDescription>
                  Visualização completa de dados para auditoria zootécnica e exportação.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="text-xs gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Inner Content based on report type */}
          <div className="py-2 space-y-4">
            {activeReportModal === 'rebanho' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className="p-2">Brinco</th>
                      <th className="p-2">Nome</th>
                      <th className="p-2">Categoria</th>
                      <th className="p-2">Sexo</th>
                      <th className="p-2">Raça</th>
                      <th className="p-2">Nascimento</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {animais.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2 font-bold">{a.brinco}</td>
                        <td className="p-2">{a.nome || '—'}</td>
                        <td className="p-2 capitalize">{a.categoria}</td>
                        <td className="p-2 capitalize">{a.sexo}</td>
                        <td className="p-2">{a.raca}</td>
                        <td className="p-2">
                          {a.data_nascimento
                            ? new Date(a.data_nascimento).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{a.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeReportModal === 'reproducao' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className="p-2">Vaca / Matriz</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Touro / Sêmen</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reproducoes.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 font-bold">
                          {r.expand?.animal_id?.brinco || r.animal_id}
                        </td>
                        <td className="p-2 capitalize">{r.tipo}</td>
                        <td className="p-2">{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                        <td className="p-2">{r.touro_semen || '—'}</td>
                        <td className="p-2">
                          <Badge variant="outline">{r.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeReportModal === 'sanidade' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className="p-2">Animal</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2">Produto</th>
                      <th className="p-2">Próxima Dose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sanidades.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2 font-bold">
                          {s.expand?.animal_id?.brinco || s.animal_id}
                        </td>
                        <td className="p-2">{new Date(s.data).toLocaleDateString('pt-BR')}</td>
                        <td className="p-2 capitalize">{s.tipo}</td>
                        <td className="p-2">{s.descricao}</td>
                        <td className="p-2">{s.produto || '—'}</td>
                        <td className="p-2">
                          {s.proxima_dose
                            ? new Date(s.proxima_dose).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeReportModal === 'producao' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className="p-2">Matriz</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Volume</th>
                      <th className="p-2">Turno</th>
                      <th className="p-2">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {producoes.map((pl) => (
                      <tr key={pl.id}>
                        <td className="p-2 font-bold">
                          {pl.expand?.animal_id?.brinco || pl.animal_id}
                        </td>
                        <td className="p-2">{new Date(pl.data).toLocaleDateString('pt-BR')}</td>
                        <td className="p-2 font-bold">{pl.quantidade_litros} L</td>
                        <td className="p-2 capitalize">{pl.turno}</td>
                        <td className="p-2">{pl.observacoes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeReportModal === 'pesagem' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className="p-2">Animal</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Peso Balança</th>
                      <th className="p-2">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pesagens.map((p) => (
                      <tr key={p.id}>
                        <td className="p-2 font-bold">
                          {p.expand?.animal_id?.brinco || p.animal_id}
                        </td>
                        <td className="p-2">{new Date(p.data).toLocaleDateString('pt-BR')}</td>
                        <td className="p-2 font-bold">{p.peso} kg</td>
                        <td className="p-2">{p.observacoes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
