import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { useRealtimeConnection } from '@/realtime/use-realtime-connection'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  useRealtimeConnection()
  return (
    <>
      <Outlet />
      <Toaster position="top-right" />
    </>
  )
}
