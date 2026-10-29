import { QueryClient } from '@tanstack/react-query'
import type { CatalogQuery, Network } from '@/contracts'
import { ApiError } from './client'

/**
 * Chaves de cache. Tudo que é privado fica sob `['user', userId, ...]`, o que
 * isola os dados por usuário e permite descartá-los de uma vez no logout ou
 * na troca de conta. O carrinho é chaveado pelo dono (usuário ou visitante).
 */
export const queryKeys = {
  catalog: (query: CatalogQuery) => ['catalog', 'list', query] as const,
  catalogAll: ['catalog'] as const,
  featured: ['catalog', 'featured'] as const,
  nft: (id: string) => ['nft', id] as const,
  related: (id: string) => ['nft', id, 'related'] as const,
  session: ['session'] as const,
  user: (userId: string) => ['user', userId] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  order: (userId: string, orderId: string) => ['user', userId, 'orders', orderId] as const,
  orders: (userId: string) => ['user', userId, 'orders'] as const,
  cartAll: ['cart'] as const,
  cart: (owner: string, network: Network = 'ethereum') => ['cart', owner, network] as const,
}

/**
 * Política de cache e retries (documentada no ARCHITECTURE.md):
 * - leituras: `staleTime` de 30 s; até 2 retries com backoff exponencial,
 *   apenas para falhas transitórias (rede, timeout, 5xx). 4xx nunca é repetido;
 * - mutations: sem retry automático (o pedido tem fluxo próprio com idempotência);
 * - refetch ao focar a janela e ao reconectar a rede.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => error instanceof ApiError && error.isTransient && failureCount < 2,
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3_000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
