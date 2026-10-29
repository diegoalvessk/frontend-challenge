import { Fragment, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { WifiOff } from 'lucide-react'
import { useAnnouncement } from '@/lib/announcer'
import { cn } from '@/lib/utils'
import { useConnectionStatus } from '@/realtime/use-realtime-connection'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1248px] px-6', className)}>{children}</div>
}

export interface Crumb {
  label: string
  to?: string
  hash?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn('hidden text-base font-bold md:block', className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 && (
              <li aria-hidden className="text-foreground">
                /
              </li>
            )}
            <li>
              {item.to ? (
                <Link to={item.to} hash={item.hash} className="hover:text-amber">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

/** Região live global para leitores de tela (mutations e tempo real). */
export function LiveRegion() {
  const message = useAnnouncement()
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
      {message}
    </div>
  )
}

/** Aviso discreto quando o canal de tempo real cai (com reconexão automática). */
export function ConnectionBanner() {
  const status = useConnectionStatus()
  if (status === 'connected' || status === 'connecting') return null
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-popover px-4 py-2 text-sm text-foreground shadow-lg md:bottom-6"
      data-testid="connection-banner"
    >
      <WifiOff className="size-4 text-coral" aria-hidden />
      {status === 'offline' ? 'Sem conexão. Tentando reconectar…' : 'Reconectando às atualizações em tempo real…'}
    </div>
  )
}

/** Estado de erro padrão com ação de nova tentativa. */
export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
  retrying,
  className,
}: {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-coral/40 bg-card px-6 py-10 text-center', className)}>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 inline-flex h-10 items-center rounded-md bg-primary px-5 font-bold text-primary-foreground hover:bg-amber disabled:opacity-60"
        >
          {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
        </button>
      )}
    </div>
  )
}
