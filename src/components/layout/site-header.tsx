import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LogIn, LogOut, Menu, Search, ShoppingCart, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useLogout } from '@/features/auth/use-auth'
import { useSession } from '@/features/auth/session-store'
import { useCart } from '@/features/cart/use-cart'
import { cn } from '@/lib/utils'
import { useSearchDialog } from './use-search-dialog'
import { UserAvatar } from './user-avatar'

const NAV = [
  { label: 'Início', to: '/', hash: undefined, match: (p: string) => p === '/' },
  { label: 'Mercado', to: '/', hash: 'catalogo', match: (p: string) => /^\/(nft|carrinho|pagamento|pedidos)/.test(p) },
  { label: 'Criadores', to: '/em-breve/$secao', params: { secao: 'criadores' }, match: (p: string) => p === '/em-breve/criadores' },
  { label: 'Aprenda', to: '/em-breve/$secao', params: { secao: 'aprenda' }, match: (p: string) => p === '/em-breve/aprenda' },
] as const

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.1em] text-foreground', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}

function CartLink() {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className="relative grid size-10 place-items-center text-foreground hover:text-amber"
      aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
    >
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span
          className="absolute top-1 right-0 grid min-w-4 place-items-center rounded-full border-2 border-background bg-primary px-0.5 text-[10px] leading-3 font-medium text-primary-foreground"
          aria-hidden
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function AccountMenu() {
  const session = useSession()
  const logout = useLogout()
  const pathname = useRouterState({ select: (s) => s.location.href })

  if (!session) {
    return (
      <Button asChild size="sm" className="h-9 gap-1.5 px-3 text-base font-medium">
        <Link to="/entrar" search={{ redirect: pathname }}>
          <LogIn className="size-5" aria-hidden />
          Entrar
        </Link>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Conta de ${session.user.displayName}`}>
        <UserAvatar user={session.user} className="size-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border bg-popover">
        <DropdownMenuLabel className="truncate">{session.user.displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <User aria-hidden /> Dados do perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/perfil/carteiras">
            <Wallet aria-hidden /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Cabeçalho desktop/tablet (no mobile cada tela tem sua barra superior). */
export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useSearchDialog()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    // Fixo ao rolar só no desktop (no mobile as telas têm barra própria e navegação inferior).
    <header className="hidden border-b border-primary/30 md:sticky md:top-0 md:z-40 md:block md:bg-background">
      <div className="mx-auto flex h-[69px] max-w-[1248px] items-start justify-between px-6 pt-6">
        <div className="flex w-40 items-center gap-2 pt-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-ml-2 lg:hidden" aria-label="Abrir menu">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="border-border bg-card">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <SheetDescription className="sr-only">Navegação principal</SheetDescription>
              <nav aria-label="Principal" className="flex flex-col p-4">
                {NAV.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    hash={"hash" in item ? item.hash : undefined}
                    params={"params" in item ? item.params : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn('py-3 text-base', item.match(pathname) ? 'font-bold text-amber' : 'text-foreground')}
                    aria-current={item.match(pathname) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Logo />
        </div>

        <nav aria-label="Principal" className="hidden gap-10 lg:flex">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.label}
                to={item.to}
                hash={"hash" in item ? item.hash : undefined}
                params={"params" in item ? item.params : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-[45px] border-b-[3px] text-base leading-[21px] transition-colors hover:text-amber',
                  active ? 'border-primary font-bold text-amber' : 'border-transparent text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="grid size-10 place-items-center text-foreground hover:text-amber"
            onClick={(event) => search.openFrom(event.currentTarget)}
            aria-label="Buscar NFTs"
          >
            <Search className="size-5" aria-hidden />
          </button>
          <CartLink />
          <AccountMenu />
        </div>
      </div>
      {search.dialog}
    </header>
  )
}
