import type { ReactNode } from 'react'
import { Link, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, House, ScanSearch, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/features/cart/use-cart'
import { cn } from '@/lib/utils'

/** Barra superior das telas mobile: voltar + título (+ ação opcional). */
export function MobileTopBar({ title, fallback = '/', action }: { title: string; fallback?: string; action?: ReactNode }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <div className="flex items-center gap-4 px-6 pt-6 pb-4 md:hidden">
      <button
        type="button"
        onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: fallback }))}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-amber"
        aria-label="Voltar"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </div>
  )
}

/** Navegação inferior do mobile (home e área do colecionador). */
export function MobileBottomNav({ onSearch }: { onSearch?: (opener: HTMLElement) => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  const item = (active: boolean) =>
    cn('grid size-11 place-items-center rounded-full', active ? 'text-amber' : 'text-sand hover:text-amber')

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:hidden"
    >
      <ul className="mx-auto flex h-[72px] max-w-md items-center justify-around px-4">
        <li>
          <Link to="/" className={item(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}>
            <House className="size-6" aria-hidden />
          </Link>
        </li>
        <li>
          <Link to="/perfil/favoritos" className={item(pathname === '/perfil/favoritos')} aria-label="Favoritos">
            <Heart className="size-6" aria-hidden />
          </Link>
        </li>
        <li className="-mt-10">
          <button
            type="button"
            onClick={(event) => onSearch?.(event.currentTarget)}
            className="grid size-16 place-items-center rounded-full border-4 border-background bg-gradient-to-br from-amber to-copper text-primary-foreground"
            aria-label="Buscar NFTs"
          >
            <ScanSearch className="size-7" aria-hidden />
          </button>
        </li>
        <li>
          <Link to="/carrinho" className={cn(item(pathname === '/carrinho'), 'relative')} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart className="size-6" aria-hidden />
            {count > 0 && (
              <span className="absolute top-1 right-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold text-primary-foreground" aria-hidden>
                {count}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link to="/perfil" className={item(pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos')} aria-label="Perfil">
            <User className="size-6" aria-hidden />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
