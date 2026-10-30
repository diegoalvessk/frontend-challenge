import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { AlertTriangle, Download, Heart, LineChart, LogOut, MapPin, ShoppingCart, User } from 'lucide-react'
import { MobileBottomNav } from '@/components/layout/mobile'
import { Container } from '@/components/layout/page'
import { requireAuth } from '@/features/auth/require-auth'
import { useSession } from '@/features/auth/session-store'
import { useLogout } from '@/features/auth/use-auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/perfil')({
  beforeLoad: requireAuth,
  component: ProfileLayout,
})

const ITEMS = [
  { label: 'Dados do perfil', to: '/perfil', icon: User },
  { label: 'Carteiras', to: '/perfil/carteiras', icon: MapPin },
  { label: 'Lista de interesse', to: '/perfil/favoritos', icon: Heart },
] as const

const SOON = [
  { label: 'Atividade', secao: 'atividade', icon: ShoppingCart },
  { label: 'Ofertas', secao: 'ofertas', icon: LineChart },
  { label: 'Arquivos baixados', secao: 'downloads', icon: Download },
  { label: 'Suporte', secao: 'suporte', icon: AlertTriangle },
] as const

function ProfileLayout() {
  // Sessão encerrada nesta tela: o ciclo de vida da sessão redireciona ao login.
  if (!useSession()) return null
  return <ProfileShell />
}

function ProfileShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, '') })
  const logout = useLogout()
  const item = (active: boolean) =>
    cn(
      'flex h-11 shrink-0 items-center gap-3 border-l-4 px-3 text-base whitespace-nowrap transition-colors md:h-[45px]',
      active ? 'border-primary text-amber' : 'border-transparent text-amber/90 hover:bg-secondary',
    )

  return (
    <div className="pb-28 md:pb-0">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-7 lg:grid-cols-[310px_minmax(0,1fr)] md:pt-8">
        <aside className="h-fit bg-card md:pb-0" aria-label="Meu perfil">
          <p className="px-3 pt-5 pb-1 text-xl font-bold md:px-2.5">Meu perfil</p>
          <nav aria-label="Seções do perfil" className="flex overflow-x-auto md:flex-col">
            {ITEMS.map(({ label, to, icon: Icon }) => (
              // exact: sem ele o Router marca /perfil como ativo (aria-current) em qualquer subpágina do perfil.
              <Link key={to} to={to} activeOptions={{ exact: true }} className={item(pathname === to)} aria-current={pathname === to ? 'page' : undefined}>
                <Icon className="size-5" aria-hidden /> {label}
              </Link>
            ))}
            {SOON.map(({ label, secao, icon: Icon }) => {
              const active = pathname === `/perfil/em-breve/${secao}`
              return (
                <Link
                  key={secao}
                  to="/perfil/em-breve/$secao"
                  params={{ secao }}
                  className={cn(item(active), 'max-md:hidden')}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="size-5" aria-hidden /> {label}
                </Link>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="hidden w-full items-center gap-3 border-t border-border px-4 py-3 text-base font-bold text-amber hover:bg-secondary md:flex"
          >
            <LogOut className="size-5" aria-hidden /> Sair
          </button>
        </aside>
        <div className="min-w-0">
          <Outlet />
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="mt-10 flex items-center gap-2 font-bold text-amber md:hidden"
          >
            <LogOut className="size-5" aria-hidden /> Sair da conta
          </button>
        </div>
      </Container>
      <MobileBottomNav />
    </div>
  )
}
