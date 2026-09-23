import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'
import { toast } from '@/hooks/use-toast'
import {
  Tractor,
  LayoutDashboard,
  Beef,
  HeartPulse,
  Syringe,
  Wheat,
  Scale,
  Milk,
  FileBarChart,
  LogOut,
  Settings,
  Menu,
  Database,
  Building2,
  ChevronRight,
  User,
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/animais', label: 'Animais', icon: Beef },
  { path: '/reproducao', label: 'Reprodução', icon: HeartPulse },
  { path: '/sanidade', label: 'Sanidade', icon: Syringe },
  { path: '/alimentacao', label: 'Alimentação', icon: Wheat },
  { path: '/pesagem', label: 'Pesagem', icon: Scale },
  { path: '/producao', label: 'Produção', icon: Milk },
  { path: '/relatorios', label: 'Relatórios', icon: FileBarChart },
]

export default function Layout() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fazendaNome, setFazendaNome] = useState(user?.fazenda_nome || 'Fazenda Principal')
  const [userName, setUserName] = useState(user?.name || 'Produtor Rural')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (user) {
      setFazendaNome(user.fazenda_nome || 'Fazenda Principal')
      setUserName(user.name || 'Produtor Rural')
    }
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSavingSettings(true)
    try {
      await pb.collection('users').update(user.id, {
        name: userName,
        fazenda_nome: fazendaNome,
      })
      await refreshUser()
      toast({
        title: 'Configurações atualizadas',
        description: 'Dados da fazenda foram salvos com sucesso.',
      })
      setSettingsOpen(false)
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const userInitials = (user?.name || 'PR')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      {/* Top Fixed Header with Blur */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 border-b ${
          scrolled
            ? 'bg-background/85 backdrop-blur-md shadow-xs border-border/80'
            : 'bg-card border-border/60'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Farm Identity */}
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-foreground">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 flex flex-col justify-between">
                <div>
                  <SheetHeader className="p-4 border-b border-border/60 text-left bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        <Tractor className="h-6 w-6" />
                      </div>
                      <div>
                        <SheetTitle className="text-base font-bold text-foreground">
                          Pecuária Manager
                        </SheetTitle>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.fazenda_nome || 'Fazenda Conectada'}
                        </p>
                      </div>
                    </div>
                  </SheetHeader>

                  <nav className="p-3 space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const isActive = location.pathname === item.path
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon
                            className={`h-4.5 w-4.5 ${isActive ? 'text-primary-foreground' : 'text-primary'}`}
                          />
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </nav>
                </div>

                <div className="p-4 border-t border-border/60 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 bg-primary/10 text-primary border border-primary/20">
                      <AvatarFallback className="text-xs font-bold text-primary">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="truncate text-xs">
                      <p className="font-semibold text-foreground truncate">
                        {user?.name || 'Produtor'}
                      </p>
                      <p className="text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-medium justify-center"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        setSettingsOpen(true)
                      }}
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Ajustes
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs font-medium justify-center"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1" />
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                <Tractor className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-foreground">
                    Pecuária Manager
                  </span>
                  <span className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20">
                    Agro v2.5
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3 text-secondary" />
                  <span className="truncate max-w-[180px] font-medium">
                    {user?.fazenda_nome || 'Fazenda Principal'}
                  </span>
                </div>
              </div>
            </NavLink>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-foreground/75 hover:text-foreground hover:bg-muted/70'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-primary/80'}`}
                  />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* User Dropdown */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-xl hover:bg-muted/70 transition-colors border border-transparent hover:border-border/60 focus:outline-hidden cursor-pointer"
                >
                  <Avatar className="h-8 w-8 bg-primary/10 border border-primary/20">
                    <AvatarFallback className="text-xs font-bold text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold leading-tight text-foreground truncate max-w-[120px]">
                      {user?.name || 'Produtor'}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[120px]">
                      {user?.fazenda_nome || 'Fazenda'}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">
                      {user?.name || 'Produtor Rural'}
                    </p>
                    <p className="text-xs text-muted-foreground leading-none">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/relatorios" className="cursor-pointer flex items-center">
                    <FileBarChart className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Relatórios Gerenciais</span>
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair do Sistema</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area Constraint */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
        <Outlet />
      </main>

      {/* Global Footer */}
      <footer className="w-full border-t border-border/80 bg-card py-5 mt-auto">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Pecuária Manager</span>
            <span>•</span>
            <span>v2.5.0</span>
            <span>•</span>
            <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Database className="h-3 w-3 animate-pulse" />
              <span>PocketBase Conectado</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span
              className="hover:text-foreground transition-colors cursor-pointer"
              onClick={() => setSettingsOpen(true)}
            >
              Suporte da Fazenda
            </span>
            <span>•</span>
            <span>Módulo de Pecuária &copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configurações da Propriedade</DialogTitle>
            <DialogDescription>
              Atualize as informações do produtor e nome da fazenda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="userName">Nome do Produtor / Responsável</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="userName"
                  className="pl-9"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fazendaNome">Nome da Fazenda / Rebanho</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fazendaNome"
                  className="pl-9"
                  value={fazendaNome}
                  onChange={(e) => setFazendaNome(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 border border-border/60 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Informações de Acesso:</p>
              <p>Email: {user?.email}</p>
              <p>ID do Produtor: {user?.id}</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
