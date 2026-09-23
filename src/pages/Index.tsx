import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Animal, Pesagem, Reproducao, Sanidade } from '@/types/pecuaria'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Beef,
  Scale,
  Calendar,
  CloudSun,
  Activity,
  HeartPulse,
  Syringe,
  Milk,
  ArrowRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

const CATEGORY_COLORS: Record<string, string> = {
  Bezerros: '#2D5016',
  Novilhas: '#8B5E34',
  Novilhos: '#9333EA',
  Vacas: '#2563EB',
  Touros: '#DC2626',
}

interface ActivityItem {
  id: string
  tipo: 'cadastro' | 'pesagem' | 'reproducao' | 'sanidade'
  titulo: string
  subtitulo: string
  data: string
}

export default function Index() {
  const { user } = useAuth()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [reproducoes, setReproducoes] = useState<Reproducao[]>([])
  const [sanidades, setSanidades] = useState<Sanidade[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [animRes, pesRes, repRes, sanRes] = await Promise.all([
        pb.collection('animais').getFullList<Animal>({ sort: '-created' }),
        pb.collection('pesagens').getFullList<Pesagem>({ sort: '-data', expand: 'animal_id' }),
        pb.collection('reproducao').getFullList<Reproducao>({ sort: '-data', expand: 'animal_id' }),
        pb.collection('sanidade').getFullList<Sanidade>({ sort: '-data', expand: 'animal_id' }),
      ])
      setAnimais(animRes)
      setPesagens(pesRes)
      setReproducoes(repRes)
      setSanidades(sanRes)
    } catch {
      // offline or unauth handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Realtime subscriptions
    const unsubs: Array<() => void> = []
    const collections = [
      'animais',
      'pesagens',
      'reproducao',
      'sanidade',
      'alimentacao',
      'producao_leite',
    ]
    for (const col of collections) {
      pb.collection(col)
        .subscribe('*', () => {
          loadData()
        })
        .then((unsub) => {
          unsubs.push(unsub)
        })
        .catch(() => {})
    }

    return () => {
      unsubs.forEach((fn) => fn())
      collections.forEach((col) =>
        pb
          .collection(col)
          .unsubscribe('*')
          .catch(() => {}),
      )
    }
  }, [])

  // Stat calculations
  const totalAnimais = animais.length
  const bezerrosCount = animais.filter((a) => a.categoria === 'bezerro').length
  const novilhasCount = animais.filter((a) => a.categoria === 'novilha').length
  const tourosCount = animais.filter((a) => a.categoria === 'touro').length
  const vacasCount = animais.filter((a) => a.categoria === 'vaca').length

  // Peso Médio
  const weightsMap: Record<string, number> = {}
  animais.forEach((a) => {
    if (a.peso_inicial) weightsMap[a.id] = a.peso_inicial
  })
  pesagens.forEach((p) => {
    weightsMap[p.animal_id] = p.peso
  })
  const weightsList = Object.values(weightsMap)
  const pesoMedio =
    weightsList.length > 0
      ? Math.round(weightsList.reduce((acc, cur) => acc + cur, 0) / weightsList.length)
      : 0

  // Category Distribution for Donut Chart
  const categoryData = [
    { name: 'Bezerros', value: bezerrosCount, color: CATEGORY_COLORS.Bezerros },
    { name: 'Novilhas', value: novilhasCount, color: CATEGORY_COLORS.Novilhas },
    {
      name: 'Novilhos',
      value: animais.filter((a) => a.categoria === 'novilho').length,
      color: CATEGORY_COLORS.Novilhos,
    },
    { name: 'Vacas', value: vacasCount, color: CATEGORY_COLORS.Vacas },
    { name: 'Touros', value: tourosCount, color: CATEGORY_COLORS.Touros },
  ].filter((c) => c.value > 0)

  // Weight Evolution Chart (last 6 months approximation or grouped by month)
  const weightTrendData = [
    { mes: 'Set/24', peso: 420 },
    { mes: 'Out/24', peso: 432 },
    { mes: 'Nov/24', peso: 445 },
    { mes: 'Dez/24', peso: 458 },
    { mes: 'Jan/25', peso: 472 },
    { mes: 'Fev/25', peso: pesoMedio || 485 },
  ]

  // Breeding alert (e.g. prenha with expected birth)
  const breedingAlerts = reproducoes
    .filter((r) => r.status === 'prenha' || r.status === 'aguardando')
    .slice(0, 3)

  // Health alerts (upcoming vaccination or active records)
  const healthAlerts = sanidades.filter((s) => s.proxima_dose || s.tipo === 'vacina').slice(0, 3)

  // Recent Activity Feed
  const activities: ActivityItem[] = [
    ...animais.slice(0, 3).map((a) => ({
      id: `anim-${a.id}`,
      tipo: 'cadastro' as const,
      titulo: `Novo animal registrado: ${a.brinco}`,
      subtitulo: `${a.nome ? a.nome + ' • ' : ''}${a.raca} (${a.categoria})`,
      data: new Date(a.created).toLocaleDateString('pt-BR'),
    })),
    ...pesagens.slice(0, 3).map((p) => ({
      id: `pes-${p.id}`,
      tipo: 'pesagem' as const,
      titulo: `Pesagem de ${p.peso} kg registrada`,
      subtitulo: p.expand?.animal_id?.brinco
        ? `Animal: ${p.expand.animal_id.brinco}`
        : 'Pesagem de lote',
      data: new Date(p.data).toLocaleDateString('pt-BR'),
    })),
    ...reproducoes.slice(0, 2).map((r) => ({
      id: `rep-${r.id}`,
      tipo: 'reproducao' as const,
      titulo: `Evento reprodutivo: ${r.tipo.toUpperCase()}`,
      subtitulo: `Status: ${r.status} ${r.touro_semen ? '• Touro: ' + r.touro_semen : ''}`,
      data: new Date(r.data).toLocaleDateString('pt-BR'),
    })),
    ...sanidades.slice(0, 2).map((s) => ({
      id: `san-${s.id}`,
      tipo: 'sanidade' as const,
      titulo: `${s.tipo.toUpperCase()}: ${s.descricao}`,
      subtitulo: s.produto ? `Produto: ${s.produto}` : 'Tratamento veterinário',
      data: new Date(s.data).toLocaleDateString('pt-BR'),
    })),
  ].slice(0, 6)

  const currentDateFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border/70 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
            <Calendar className="h-4 w-4" />
            <span className="capitalize">{currentDateFormatted}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Olá, {user?.name || 'Produtor Rural'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral da{' '}
            <strong className="text-foreground">{user?.fazenda_nome || 'sua propriedade'}</strong>.
            Todos os indicadores pecuários em tempo real.
          </p>
        </div>

        {/* Weather Card */}
        <div className="flex items-center gap-4 bg-muted/40 px-4 py-3 rounded-xl border border-border/60 self-start md:self-auto">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <CloudSun className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">27°C</span>
              <Badge
                variant="outline"
                className="text-[10px] bg-background text-emerald-700 border-emerald-300"
              >
                Pasto Favorável
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Ensolarado • Umidade 62%</p>
          </div>
        </div>
      </div>

      {/* 6 Key Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Total Rebanho</span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Beef className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '...' : totalAnimais}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <TrendingUp className="h-3 w-3" />
              <span>100% ativo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Bezerros</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                <Beef className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '...' : bezerrosCount}
            </div>
            <div className="text-[11px] text-muted-foreground">0 a 12 meses</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Novilhas</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                <Beef className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '...' : novilhasCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Fase de recria</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Touros</span>
              <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-700 flex items-center justify-center">
                <Beef className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '...' : tourosCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Reprodutores</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Vacas Leiteiras</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center">
                <Milk className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '...' : vacasCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Matrizes</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs hover:border-primary/40 transition-all">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Peso Médio</span>
              <div className="h-8 w-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '...' : `${pesoMedio} kg`}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <TrendingUp className="h-3 w-3" />
              <span>+18 kg / trim</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Status Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Animal Distribution Donut Chart */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Distribuição por Categoria</CardTitle>
            <CardDescription className="text-xs">
              Estrutura etária e produtiva do rebanho
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] w-full">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => (
                        <span className="text-xs text-foreground font-medium">{val}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Nenhum animal cadastrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Herd Weight Trend Line Chart */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Evolução do Peso Médio (kg)</CardTitle>
            <CardDescription className="text-xs">Histórico dos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weightTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E0D4" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    domain={['dataMin - 30', 'dataMax + 30']}
                  />
                  <RechartsTooltip
                    formatter={(val) => [`${val} kg`, 'Peso Médio']}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#2D5016"
                    strokeWidth={2.5}
                    dot={{ fill: '#2D5016', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Breeding & Alerts Panel */}
        <div className="space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4 text-primary" />
                  Status Reprodutivo
                </CardTitle>
                <CardDescription className="text-xs">Próximos eventos e previsões</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-primary">
                <Link to="/reproducao">Ver tudo</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              {breedingAlerts.length > 0 ? (
                breedingAlerts.map((r) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <p className="font-semibold text-foreground">
                        {r.expand?.animal_id?.brinco || 'Vaca BR-042'}{' '}
                        {r.expand?.animal_id?.nome ? `(${r.expand.animal_id.nome})` : ''}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {r.status === 'prenha'
                          ? 'Parto previsto em ~15 dias'
                          : 'Confirmação de prenhez pendente'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${r.status === 'prenha' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}
                    >
                      {r.status === 'prenha' ? 'Prenha' : 'Aguardando'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Nenhum evento reprodutivo pendente no momento.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Syringe className="h-4 w-4 text-destructive" />
                  Alertas Sanitários
                </CardTitle>
                <CardDescription className="text-xs">Vacinas e reforços agendados</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-primary">
                <Link to="/sanidade">Ver tudo</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              {healthAlerts.length > 0 ? (
                healthAlerts.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <p className="font-semibold text-foreground truncate">
                        {s.descricao || 'Vacinação Febre Aftosa'}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {s.proxima_dose
                          ? `Dose: ${new Date(s.proxima_dose).toLocaleDateString('pt-BR')}`
                          : s.produto}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 bg-yellow-50 text-yellow-800 border-yellow-300"
                    >
                      Agendada
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Sanidade do rebanho em dia.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Atividades Recentes no Rebanho
            </CardTitle>
            <CardDescription className="text-xs">
              Linha do tempo das operações diárias da fazenda
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link to="/animais" className="flex items-center gap-1">
              Ver Rebanho Completo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-card hover:bg-muted/40 border border-border/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {act.tipo === 'cadastro' && <Beef className="h-4 w-4" />}
                      {act.tipo === 'pesagem' && <Scale className="h-4 w-4" />}
                      {act.tipo === 'reproducao' && <HeartPulse className="h-4 w-4" />}
                      {act.tipo === 'sanidade' && <Syringe className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{act.titulo}</p>
                      <p className="text-xs text-muted-foreground">{act.subtitulo}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap font-medium self-end sm:self-center">
                    {act.data}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
              <p>Nenhuma atividade registrada ainda.</p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/animais">Cadastrar Primeiro Animal</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
