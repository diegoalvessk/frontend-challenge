import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MockPanel } from '@/components/layout/mock-panel'
import { ConnectionBanner, Container, ErrorState, LiveRegion } from '@/components/layout/page'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { useSessionLifecycle } from '@/features/auth/use-auth'
import { useRealtimeConnection } from '@/realtime/use-realtime-connection'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <Container className="py-16">
      <ErrorState message={error instanceof Error ? error.message : 'Erro inesperado.'} onRetry={reset} />
    </Container>
  ),
})

function RootLayout() {
  useSessionLifecycle()
  useRealtimeConnection()
  return (
    <TooltipProvider>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <LiveRegion />
      <ConnectionBanner />
      <MockPanel />
      <Toaster position="top-right" closeButton />
    </TooltipProvider>
  )
}

export function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-amber">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-md text-muted-foreground">O endereço acessado não existe ou foi removido. Que tal voltar ao mercado?</p>
      <Link to="/" className="mt-2 inline-flex h-10 items-center rounded-md bg-primary px-5 font-bold text-primary-foreground hover:bg-amber">
        Ir para o início
      </Link>
    </Container>
  )
}
