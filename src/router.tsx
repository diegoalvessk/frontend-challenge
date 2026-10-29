import { createRouter } from '@tanstack/react-router'
import { createQueryClient } from './api/query-client'
import { routeTree } from './routeTree.gen'
import { RouteError } from './routes/__root'

export const queryClient = createQueryClient()

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Os loaders apenas "aquecem" o cache; o TanStack Query decide quando refazer.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
